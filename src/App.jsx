import React, { useState, useEffect } from 'react';
import KioskView from './components/KioskView';
import AdminView from './components/AdminView';
import {
  loadSettings,
  saveSettings,
  loadWorkTypes,
  saveWorkTypes,
  loadEmployees,
  saveEmployees,
  loadAttendanceRecords,
  saveAttendanceRecords,
  loadActiveShifts,
  saveActiveShifts,
  loadSchedules,
  saveSchedules,
  syncRecordToGoogleSheets,
  flushOfflineQueue,
} from './utils/storage';
import { calculateDailyRecord } from './utils/calculator';

export default function App() {
  const [viewMode, setViewMode] = useState('kiosk'); // 'kiosk' | 'admin'

  // 상태 관리
  const [settings, setSettings] = useState(loadSettings);
  const [workTypes, setWorkTypes] = useState(loadWorkTypes);
  const [employees, setEmployees] = useState(loadEmployees);
  const [attendanceRecords, setAttendanceRecords] = useState(loadAttendanceRecords);
  const [activeShifts, setActiveShifts] = useState(loadActiveShifts);
  const [schedules, setSchedules] = useState(() => loadSchedules(employees));

  // 로컬스토리지 영구 동기화
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    saveSchedules(schedules);
  }, [schedules]);

  useEffect(() => {
    saveWorkTypes(workTypes);
  }, [workTypes]);

  useEffect(() => {
    saveEmployees(employees);
  }, [employees]);

  useEffect(() => {
    saveAttendanceRecords(attendanceRecords);
  }, [attendanceRecords]);

  useEffect(() => {
    saveActiveShifts(activeShifts);
  }, [activeShifts]);

  // 네트워크 복구 시 오프라인 큐 동기화
  useEffect(() => {
    const handleOnline = () => {
      flushOfflineQueue(settings.googleScriptUrl);
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [settings.googleScriptUrl]);

  // 1. 출근 처리 로직 (PRD 4.1 조항 완벽 반영 + 월별 스케줄 연동)
  const handleCheckIn = (employee, { time, isCustom, plannedTime }) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const dayPlan = schedules.find(
      (s) => s.date === todayStr && s.empId === employee.id && !s.isOff
    );
    const finalPlannedTime = plannedTime || dayPlan?.startTime || employee.scheduledStartTime;

    const newShift = {
      empId: employee.id,
      date: todayStr,
      checkInTime: time,
      plannedTime: finalPlannedTime,
      isCustom,
      startedAt: new Date().toISOString(),
    };

    const nextShifts = {
      ...activeShifts,
      [employee.id]: newShift,
    };
    setActiveShifts(nextShifts);

    // 구글 시트 및 로컬 기록용 안내 메시지
    if (isCustom) {
      alert(`[출근 완료] ${employee.name} 파트너님, 직접 입력하신 ${time}으로 출근 체크되었습니다. (사장님께 확인 요청 전달)`);
    } else {
      alert(`[출근 완료] ${employee.name} 파트너님, 계획된 스케줄 시각(${time})으로 출근 체크되었습니다. 오늘도 힘찬 하루 되세요!`);
    }
  };

  // 2. 퇴근 처리 로직 (PRD 4.2 & 4.5 조항 완벽 반영 + 계획 대비 상이 여부 자동 감지)
  const handleCheckOut = (employee, { checkOutTime, breakMinutes }) => {
    const shift = activeShifts[employee.id];
    if (!shift) return;

    const todayStr = shift.date || new Date().toISOString().split('T')[0];
    const workType = workTypes.find((w) => w.id === employee.workTypeId);

    // 실근무시간 및 급여 정밀 산정
    const calcResult = calculateDailyRecord({
      checkInTime: shift.checkInTime,
      checkOutTime,
      breakMinutes,
      hourlyWage: employee.hourlyWage,
      isUnderFive: settings.isUnderFiveEmployees,
    });

    // 해당 날짜/직원의 등록된 월별 스케줄 확인
    const dayPlan = schedules.find(
      (s) => s.date === todayStr && s.empId === employee.id && !s.isOff
    );
    const plannedStart = dayPlan?.startTime || shift.plannedTime || employee.scheduledStartTime;
    const plannedEnd = dayPlan?.endTime || employee.scheduledEndTime;

    // 계획 시각과 실제 출퇴근 시각 비교
    const isCheckInDiff = plannedStart && shift.checkInTime !== plannedStart;
    const isCheckOutDiff = plannedEnd && checkOutTime !== plannedEnd;
    const isDivergent = shift.isCustom || isCheckInDiff || isCheckOutDiff;

    // 비고 및 플래그 세팅
    let note = '정상 퇴근';
    let isApproved = true;
    if (isDivergent) {
      note = `[계획과 상이 (계획: ${plannedStart || '-'}~${plannedEnd || '-'} → 실제: ${shift.checkInTime}~${checkOutTime})]`;
      isApproved = false; // 사장 확인 필요 플래그
    }

    const newRecord = {
      id: `REC-${todayStr}-${Date.now().toString().slice(-4)}`,
      date: todayStr,
      empId: employee.id,
      empName: employee.name,
      workType: workType?.name || '파트너',
      checkInTime: shift.checkInTime,
      checkOutTime,
      breakMinutes,
      actualWorkHours: calcResult.actualWorkHours,
      hourlyWage: employee.hourlyWage,
      dailyPay: calcResult.dailyPay,
      overtimePay: calcResult.overtimePay,
      nightPay: calcResult.nightPay,
      workCategory: '정상출근', // 2단계 연차 대비 필드
      isApproved,
      isCustom: shift.isCustom,
      isDivergent,
      plannedStartTime: plannedStart,
      plannedEndTime: plannedEnd,
      note,
    };

    // 출퇴근 기록 저장
    const nextRecords = [newRecord, ...attendanceRecords];
    setAttendanceRecords(nextRecords);

    // 활성 시프트 제거
    const nextShifts = { ...activeShifts };
    delete nextShifts[employee.id];
    setActiveShifts(nextShifts);

    // 구글 시트 자동 동기화 (설정되어 있으면 전송, 없거나 오프라인이면 큐에 저장)
    syncRecordToGoogleSheets(newRecord, settings.googleScriptUrl);

    alert(`[퇴근 완료] ${employee.name} 파트너님, 오늘 실근무시간은 ${calcResult.actualWorkHours}시간입니다. 수고 많으셨습니다!`);
  };

  // 구글 시트 연동 테스트
  const handleTestGoogleSync = async () => {
    if (!settings.googleScriptUrl) {
      alert('구글 웹 앱 URL을 먼저 입력해주세요.');
      return;
    }
    const testRecord = {
      id: `TEST-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      empId: 'TEST-001',
      empName: '연동테스트',
      workType: '테스트',
      checkInTime: '10:00',
      checkOutTime: '18:00',
      breakMinutes: 60,
      actualWorkHours: 7,
      hourlyWage: settings.minWage,
      dailyPay: settings.minWage * 7,
      workCategory: '정상출근',
      isApproved: true,
      note: '구글 스프레드시트 연동 테스트 데이터입니다.',
    };

    alert('구글 시트로 테스트 데이터를 전송합니다...');
    const res = await syncRecordToGoogleSheets(testRecord, settings.googleScriptUrl);
    if (res.success) {
      alert('🎉 구글 스프레드시트 연동 성공! 시트에서 새 행이 추가되었는지 확인해보세요.');
    } else {
      alert(`전송 결과: ${res.reason}. 시트 URL과 권한 설정을 확인하세요.`);
    }
  };

  return (
    <div className="w-full min-h-screen">
      {viewMode === 'kiosk' ? (
        <KioskView
          settings={settings}
          employees={employees}
          workTypes={workTypes}
          attendanceRecords={attendanceRecords}
          activeShifts={activeShifts}
          schedules={schedules}
          onCheckIn={handleCheckIn}
          onCheckOut={handleCheckOut}
          onOpenAdmin={() => setViewMode('admin')}
        />
      ) : (
        <AdminView
          settings={settings}
          onSaveSettings={setSettings}
          employees={employees}
          onSaveEmployees={setEmployees}
          workTypes={workTypes}
          onSaveWorkTypes={setWorkTypes}
          attendanceRecords={attendanceRecords}
          onSaveAttendanceRecords={setAttendanceRecords}
          activeShifts={activeShifts}
          schedules={schedules}
          onSaveSchedules={setSchedules}
          onBackToKiosk={() => setViewMode('kiosk')}
          onTestGoogleSync={handleTestGoogleSync}
        />
      )}
    </div>
  );
}
