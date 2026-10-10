import { INITIAL_SETTINGS, INITIAL_WORK_TYPES, INITIAL_EMPLOYEES } from '../constants/initialData';

const STORAGE_KEYS = {
  SETTINGS: 'cafe_attendance_settings_v1',
  WORK_TYPES: 'cafe_attendance_work_types_v1',
  EMPLOYEES: 'cafe_attendance_employees_v1',
  ATTENDANCE: 'cafe_attendance_records_v1',
  OFFLINE_QUEUE: 'cafe_attendance_offline_queue_v1',
  ACTIVE_SHIFTS: 'cafe_attendance_active_shifts_v1',
};

// 초기 샘플 출퇴근 기록 (사장님이 즉시 관리자 화면에서 확인해 볼 수 있도록 최근 3일치 기록 생성)
function generateSampleRecords() {
  const today = new Date();
  const records = [];
  
  // 지난주 및 이번 주 샘플 데이터
  for (let i = 4; i >= 1; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];

    // 김민지 (월/수/금 근무 중 샘플)
    records.push({
      id: `REC-${dateStr}-001`,
      date: dateStr,
      empId: 'EMP-001',
      empName: '김민지',
      workType: '초단시간 파트너',
      checkInTime: '13:00',
      checkOutTime: '17:30',
      breakMinutes: 30,
      actualWorkHours: 4.0,
      hourlyWage: 10030,
      dailyPay: 40120,
      workCategory: '정상출근',
      isApproved: true,
      approvalType: '정시인정',
      note: '정상 근무',
    });

    // 박지훈 (주 25시간 파트타이머)
    records.push({
      id: `REC-${dateStr}-002`,
      date: dateStr,
      empId: 'EMP-002',
      empName: '박지훈',
      workType: '파트타이머',
      checkInTime: '09:00',
      checkOutTime: '14:30',
      breakMinutes: 30,
      actualWorkHours: 5.0,
      hourlyWage: 10500,
      dailyPay: 52500,
      workCategory: '정상출근',
      isApproved: true,
      approvalType: '정시인정',
      note: '정상 근무',
    });
  }

  return records;
}

export function loadSettings() {
  const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
  return data ? JSON.parse(data) : INITIAL_SETTINGS;
}

export function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
}

export function loadWorkTypes() {
  const data = localStorage.getItem(STORAGE_KEYS.WORK_TYPES);
  if (!data) return INITIAL_WORK_TYPES;
  const list = JSON.parse(data);
  // 이전 구명칭이 있으면 주 시간 명칭으로 마이그레이션
  return list.map((wt) => {
    if (wt.id === 'WT-01' && wt.name.includes('초단시간')) return { ...wt, name: '주 15시간 미만' };
    if (wt.id === 'WT-02' && wt.name.includes('파트타이머')) return { ...wt, name: '주 25시간' };
    if (wt.id === 'WT-03' && wt.name.includes('풀타임')) return { ...wt, name: '주 40시간' };
    if (wt.id === 'WT-04' && wt.name.includes('주말 전용')) return { ...wt, name: '주 16시간 (주말)' };
    return wt;
  });
}

export function saveWorkTypes(workTypes) {
  localStorage.setItem(STORAGE_KEYS.WORK_TYPES, JSON.stringify(workTypes));
}

export function loadEmployees() {
  const data = localStorage.getItem(STORAGE_KEYS.EMPLOYEES);
  return data ? JSON.parse(data) : INITIAL_EMPLOYEES;
}

export function saveEmployees(employees) {
  localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(employees));
}

export function loadAttendanceRecords() {
  const data = localStorage.getItem(STORAGE_KEYS.ATTENDANCE);
  if (data) {
    return JSON.parse(data);
  }
  const samples = generateSampleRecords();
  localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(samples));
  return samples;
}

export function saveAttendanceRecords(records) {
  localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(records));
}

// 현재 출근 중인 직원 세션 (키오스크 실시간 상태 유지)
export function loadActiveShifts() {
  const data = localStorage.getItem(STORAGE_KEYS.ACTIVE_SHIFTS);
  return data ? JSON.parse(data) : {};
}

export function saveActiveShifts(shifts) {
  localStorage.setItem(STORAGE_KEYS.ACTIVE_SHIFTS, JSON.stringify(shifts));
}

// 구글 시트 웹앱으로 출퇴근 한 줄 추가 (오프라인 큐 내장)
export async function syncRecordToGoogleSheets(record, scriptUrl) {
  if (!scriptUrl) {
    console.log('[GoogleSheets Sync] 웹 앱 URL이 설정되지 않아 로컬스토리지에만 저장됩니다.');
    return { success: false, reason: 'URL_NOT_CONFIGURED' };
  }

  if (!navigator.onLine) {
    // 오프라인 상태: 큐에 보관
    const queue = JSON.parse(localStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE) || '[]');
    queue.push(record);
    localStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(queue));
    console.log('[GoogleSheets Sync] 오프라인 상태: 로컬 큐에 임시 보관되었습니다.');
    return { success: false, reason: 'OFFLINE_QUEUED' };
  }

  try {
    const response = await fetch(scriptUrl, {
      method: 'POST',
      mode: 'no-cors', // Google Apps Script Web App CORS 대응
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'appendAttendance',
        data: record,
      }),
    });
    console.log('[GoogleSheets Sync] 구글 시트로 성공적으로 전송 완료.');
    return { success: true };
  } catch (error) {
    console.error('[GoogleSheets Sync Error]', error);
    // 실패 시 큐에 보관
    const queue = JSON.parse(localStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE) || '[]');
    queue.push(record);
    localStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(queue));
    return { success: false, reason: 'ERROR_QUEUED', error };
  }
}

// 온라인 복구 시 큐 동기화
export async function flushOfflineQueue(scriptUrl) {
  if (!scriptUrl || !navigator.onLine) return;
  const queueStr = localStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
  if (!queueStr) return;
  const queue = JSON.parse(queueStr);
  if (queue.length === 0) return;

  console.log(`[Offline Sync] 대기 중인 ${queue.length}건의 기록 동기화 시작...`);
  const remaining = [];
  for (const item of queue) {
    try {
      await fetch(scriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'appendAttendance', data: item }),
      });
    } catch {
      remaining.push(item);
    }
  }
  localStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(remaining));
}
