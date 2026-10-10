import React, { useState } from 'react';
import {
  ArrowLeft,
  Users,
  Clock,
  Calendar,
  DollarSign,
  AlertTriangle,
  FileSpreadsheet,
  Settings as SettingsIcon,
  BookOpen,
  ExternalLink,
  CheckCircle,
  Plus,
  Trash2,
  Edit,
  Save,
  Download,
  AlertCircle,
  ShieldAlert,
  ChevronRight,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { LABOR_LAWS } from '../constants/initialData';
import {
  formatMinutesToHours,
  calculateWeeklyHolidayPay,
  getAge,
  getTenureMonths,
  truncateTenWon,
  calculateDailyRecord,
} from '../utils/calculator';
import { syncRecordToGoogleSheets } from '../utils/storage';

export default function AdminView({
  settings,
  onSaveSettings,
  employees,
  onSaveEmployees,
  workTypes,
  onSaveWorkTypes,
  attendanceRecords,
  onSaveAttendanceRecords,
  activeShifts,
  onBackToKiosk,
  onTestGoogleSync,
}) {
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'attendance' | 'payroll' | 'employees' | 'settings' | 'laws'
  const [selectedLawModal, setSelectedLawModal] = useState(null);

  // 수정용 모달 상태
  const [editingRecord, setEditingRecord] = useState(null);
  const [editReason, setEditReason] = useState('');

  // 누락 기록 수동 등록 모달 상태
  const [newManualRecord, setNewManualRecord] = useState(null);

  // 직원 편집 모달
  const [editingEmp, setEditingEmp] = useState(null);

  // 급여 정산 월 선택
  const [settleMonth, setSettleMonth] = useState('2026-10');

  // 주휴수당 승인 관리 상태 (key: `empId_weekKey` -> boolean)
  const [approvedWeeklyHolidays, setApprovedWeeklyHolidays] = useState({});

  // 1. 법적 알림 분석 엔진 (PRD 5장 명세 완벽 구현)
  const generateAlerts = () => {
    const alerts = [];

    // 1) 최저임금 미달 점검
    employees.forEach((emp) => {
      if (emp.isActive && emp.hourlyWage < settings.minWage) {
        alerts.push({
          id: `ALERT-WAGE-${emp.id}`,
          level: 'danger',
          title: `[최저임금 미달 경고] ${emp.name} 파트너`,
          message: `설정된 시급(${emp.hourlyWage.toLocaleString()}원)이 올해 법정 최저임금(${settings.minWage.toLocaleString()}원)보다 낮습니다. 차액 보정 및 계약서 수정이 필요합니다.`,
          lawId: 'LAW-07',
        });
      }
    });

    // 2) 18세 미만 청소년 야간근무 점검
    employees.forEach((emp) => {
      if (emp.isActive && getAge(emp.birthDate) < 18) {
        // 출근 기록 중 22시~06시 근무 내역 확인
        const nightWork = attendanceRecords.find(
          (r) => r.empId === emp.id && (r.checkInTime >= '22:00' || r.checkOutTime > '22:00' || r.checkInTime < '06:00')
        );
        if (nightWork) {
          alerts.push({
            id: `ALERT-YOUTH-${emp.id}`,
            level: 'danger',
            title: `[연소자 야간근로 제한] ${emp.name} (만 ${getAge(emp.birthDate)}세)`,
            message: `18세 미만 청소년은 고용노동부장관 인가 없이 22시~06시 사이 근무가 법적으로 금지되어 있습니다.`,
            lawId: 'LAW-08',
          });
        }
      }
    });

    // 3) 주 15시간 이상 주휴수당 대상 발생 점검
    employees.forEach((emp) => {
      const empRecords = attendanceRecords.filter((r) => r.empId === emp.id);
      const totalHours = empRecords.reduce((sum, r) => sum + (r.actualWorkHours || 0), 0);
      if (totalHours >= 15) {
        const { holidayHours, holidayPay } = calculateWeeklyHolidayPay(totalHours, emp.hourlyWage);
        alerts.push({
          id: `ALERT-HOLIDAY-${emp.id}`,
          level: 'info',
          title: `[주휴수당 발생 대상] ${emp.name} (주 ${totalHours.toFixed(1)}시간 근무)`,
          message: `주 15시간 이상 근무했습니다. 개근 여부를 확인 후 승인하시면 예상 주휴수당(${holidayPay.toLocaleString()}원, ${holidayHours}시간분)이 급여에 합산됩니다.`,
          lawId: 'LAW-05',
        });
      }
    });

    // 4) 초단시간 파트너 기준(주 15시간 미만) 초과 위험
    employees.forEach((emp) => {
      const workType = workTypes.find((w) => w.id === emp.workTypeId);
      if (workType?.name.includes('초단시간')) {
        const empRecords = attendanceRecords.filter((r) => r.empId === emp.id);
        const totalHours = empRecords.reduce((sum, r) => sum + (r.actualWorkHours || 0), 0);
        if (totalHours >= 15) {
          alerts.push({
            id: `ALERT-EXCEED-SHORT-${emp.id}`,
            level: 'danger',
            title: `[초단시간 기준 초과] ${emp.name} 파트너`,
            message: `주 15시간(${totalHours.toFixed(1)}h)을 초과하여 주휴수당 지급 및 퇴직금, 4대보험 가입 대상 변동 리스크가 발생합니다.`,
            lawId: 'LAW-03',
          });
        }
      }
    });

    // 5) 월 60시간(4대보험 가입 기준) 도래 점검
    employees.forEach((emp) => {
      const empRecords = attendanceRecords.filter((r) => r.empId === emp.id);
      const totalHours = empRecords.reduce((sum, r) => sum + (r.actualWorkHours || 0), 0);
      if (totalHours >= 55) {
        alerts.push({
          id: `ALERT-4INSURE-${emp.id}`,
          level: 'warning',
          title: `[4대보험 가입 검토] ${emp.name} (누적 ${totalHours.toFixed(1)}시간)`,
          message: `월 60시간 기준선에 근접/도달했습니다. 국민연금 및 건강보험 직장가입 의무 여부를 확인하세요.`,
          lawId: 'LAW-03',
        });
      }
    });

    // 6) 1년 퇴직금 발생 시점 도래 점검 (11개월 이상 근속)
    employees.forEach((emp) => {
      const tenure = getTenureMonths(emp.hireDate);
      if (emp.isActive && tenure >= 11) {
        alerts.push({
          id: `ALERT-RETIRE-${emp.id}`,
          level: 'info',
          title: `[퇴직금 발생 시점 도래] ${emp.name} (근속 ${tenure}개월차)`,
          message: `계속근로 1년 도래 시 법정 퇴직금 지급 의무가 발생합니다. (주 15시간 이상 유지자 대상)`,
          lawId: 'LAW-09',
        });
      }
    });

    // 7) 조기 출근 파트너 직접 입력 확인 필요 알림
    attendanceRecords.forEach((r) => {
      if (r.note && r.note.includes('조기 출근 직접 입력') && !r.isApproved) {
        alerts.push({
          id: `ALERT-EARLY-${r.id}`,
          level: 'warning',
          title: `[조기 출근 확인 필요] ${r.empName} (${r.date} ${r.checkInTime})`,
          message: `파트너가 계획 시각보다 일찍 출근시간을 직접 입력했습니다. 내용을 확인하고 승인하세요.`,
          recordId: r.id,
        });
      }
    });

    return alerts;
  };

  const alerts = generateAlerts();

  // 2. 급여 정산 테이블 데이터 생성
  const getPayrollSummary = () => {
    return employees
      .filter((e) => e.isActive)
      .map((emp) => {
        const empRecords = attendanceRecords.filter((r) => r.empId === emp.id);
        const totalWorkHours = empRecords.reduce((sum, r) => sum + (r.actualWorkHours || 0), 0);
        const baseSalary = truncateTenWon(totalWorkHours * emp.hourlyWage);

        // 주휴수당 (승인된 경우만)
        const isApproved = approvedWeeklyHolidays[emp.id] !== false; // 기본 승인 허용
        const { holidayPay } = calculateWeeklyHolidayPay(totalWorkHours, emp.hourlyWage);
        const approvedHolidayPay = isApproved ? holidayPay : 0;

        // 가산수당 (5인 이상 활성화 시)
        const overtimePay = settings.isUnderFiveEmployees
          ? 0
          : empRecords.reduce((sum, r) => sum + (r.overtimePay || 0) + (r.nightPay || 0), 0);

        // 연차미사용수당 (1단계: 0원 고정)
        const unusedLeavePay = 0;

        const totalPay = truncateTenWon(baseSalary + approvedHolidayPay + overtimePay + unusedLeavePay);

        return {
          empId: emp.id,
          empName: emp.name,
          workType: workTypes.find((w) => w.id === emp.workTypeId)?.name || '파트너',
          totalDays: empRecords.length,
          totalWorkHours: Number(totalWorkHours.toFixed(2)),
          hourlyWage: emp.hourlyWage,
          baseSalary,
          weeklyHolidayPay: approvedHolidayPay,
          hasHolidayEligibility: holidayPay > 0,
          overtimePay,
          unusedLeavePay,
          totalPay,
        };
      });
  };

  // 3. 엑셀 파일(.xlsx) 다운로드 기능 (PRD 핵심 요구사항)
  const handleDownloadExcel = () => {
    const payrollData = getPayrollSummary().map((row) => ({
      정산년월: settleMonth,
      직원명: row.empName,
      근무형태: row.workType,
      근무일수: `${row.totalDays}일`,
      총근로시간: `${row.totalWorkHours}시간`,
      적용시급: `${row.hourlyWage.toLocaleString()}원`,
      기본급: `${row.baseSalary.toLocaleString()}원`,
      주휴수당: `${row.weeklyHolidayPay.toLocaleString()}원`,
      가산수당: `${row.overtimePay.toLocaleString()}원`,
      연차미사용수당: `${row.unusedLeavePay}원`,
      '최종지급액(10원절사)': `${row.totalPay.toLocaleString()}원`,
    }));

    const attendanceData = attendanceRecords.map((r) => ({
      기록ID: r.id,
      근무일자: r.date,
      직원이름: r.empName,
      근무형태: r.workType,
      출근시각: r.checkInTime,
      퇴근시각: r.checkOutTime,
      휴게시간: `${r.breakMinutes || 0}분`,
      실근무시간: `${r.actualWorkHours}시간`,
      적용시급: `${r.hourlyWage.toLocaleString()}원`,
      일급: `${(r.dailyPay || 0).toLocaleString()}원`,
      근무구분: r.workCategory || '정상출근',
      승인상태: r.isApproved ? '승인완료' : '확인대기',
      비고: r.note || '',
    }));

    const wb = XLSX.utils.book_new();
    const wsPayroll = XLSX.utils.json_to_sheet(payrollData);
    const wsAttendance = XLSX.utils.json_to_sheet(attendanceData);

    XLSX.utils.book_append_sheet(wb, wsPayroll, '월별급여정산');
    XLSX.utils.book_append_sheet(wb, wsAttendance, '출퇴근기록');

    XLSX.writeFile(wb, `카페_급여정산_${settleMonth}.xlsx`);
  };

  // 출퇴근 기록 수정 저장
  const handleSaveEditRecord = () => {
    if (!editReason.trim()) {
      alert('수정 사유를 반드시 입력해주세요 (감사 로그 필수).');
      return;
    }
    const updated = attendanceRecords.map((r) => {
      if (r.id === editingRecord.id) {
        return {
          ...editingRecord,
          note: `[수정됨 ${new Date().toLocaleDateString()}] ${editReason} (기존: ${r.checkInTime}~${r.checkOutTime})`,
          isApproved: true,
        };
      }
      return r;
    });
    onSaveAttendanceRecords(updated);
    setEditingRecord(null);
    setEditReason('');
  };

  // 누락된 기록 수동 등록 저장 핸들러
  const handleSaveManualRecord = () => {
    if (!newManualRecord.empId) {
      alert('직원을 선택해주세요.');
      return;
    }
    if (!newManualRecord.date) {
      alert('근무 일자를 선택해주세요.');
      return;
    }
    if (!newManualRecord.checkInTime || !newManualRecord.checkOutTime) {
      alert('출퇴근 시간을 모두 입력해주세요.');
      return;
    }
    if (!newManualRecord.reason?.trim()) {
      alert('수동 등록 사유(예: 직원 타각 누락 확인 후 보정)를 입력해주세요.');
      return;
    }

    const emp = employees.find((e) => e.id === newManualRecord.empId);
    if (!emp) return;
    const workType = workTypes.find((w) => w.id === emp.workTypeId);

    const calc = calculateDailyRecord({
      checkInTime: newManualRecord.checkInTime,
      checkOutTime: newManualRecord.checkOutTime,
      breakMinutes: Number(newManualRecord.breakMinutes) || 0,
      hourlyWage: emp.hourlyWage,
      isUnderFive: settings.isUnderFiveEmployees,
    });

    const record = {
      id: `REC-${newManualRecord.date}-${Date.now().toString().slice(-4)}`,
      date: newManualRecord.date,
      empId: emp.id,
      empName: emp.name,
      workType: workType?.name || '파트너',
      checkInTime: newManualRecord.checkInTime,
      checkOutTime: newManualRecord.checkOutTime,
      breakMinutes: Number(newManualRecord.breakMinutes) || 0,
      actualWorkHours: calc.actualWorkHours,
      hourlyWage: emp.hourlyWage,
      dailyPay: calc.dailyPay,
      overtimePay: calc.overtimePay,
      nightPay: calc.nightPay,
      workCategory: '정상출근',
      isApproved: true,
      note: `[관리자 수동등록] ${newManualRecord.reason}`,
    };

    const nextRecords = [record, ...attendanceRecords];
    onSaveAttendanceRecords(nextRecords);
    syncRecordToGoogleSheets(record, settings.googleScriptUrl);
    setNewManualRecord(null);
    alert(`${emp.name} 파트너의 ${newManualRecord.date} 출퇴근 기록이 정상 등록되었습니다.`);
  };

  // 조기 출근 원클릭 승인
  const handleApproveRecord = (recordId) => {
    const updated = attendanceRecords.map((r) => {
      if (r.id === recordId) {
        return { ...r, isApproved: true };
      }
      return r;
    });
    onSaveAttendanceRecords(updated);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col text-slate-800">
      {/* 1. 상단 글로벌 네비게이션 */}
      <header className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToKiosk}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1.5 text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            키오스크 화면으로
          </button>
          <div className="h-6 w-px bg-slate-700 mx-2" />
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            사장님 전용 관리자 센터
          </h1>
        </div>

        {/* 탭 네비게이션 & 구글시트 바로가기 */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl text-xs font-semibold">
            {[
              { id: 'dashboard', label: '대시보드 & 법적알림', icon: AlertTriangle },
              { id: 'attendance', label: '출퇴근 기록 관리', icon: Clock },
              { id: 'payroll', label: '월별 급여 정산', icon: DollarSign },
              { id: 'employees', label: '직원 & 근무형태', icon: Users },
              { id: 'settings', label: '시스템 설정 & 구글연동', icon: SettingsIcon },
              { id: 'laws', label: '근로 법령 바로가기', icon: BookOpen },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition ${
                    isActive
                      ? 'bg-amber-500 text-slate-950 font-bold shadow'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                  {tab.id === 'dashboard' && alerts.length > 0 && (
                    <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center font-bold">
                      {alerts.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* 2. 상시 면책 안내 문구 (PRD 법적 필수 요구사항) */}
      <div className="bg-amber-100/90 border-b border-amber-200 px-6 py-2 text-xs text-amber-900 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
          <span>
            <strong>[안내]</strong> 본 시스템의 법적 알림 및 계산식은 사장님의 노무 관리를 돕기 위한 참고용이며, 법적 효력을 보장하지 않습니다. 최종 판단은 공인노무사 또는 고용노동부(☎ 1350) 확인이 필요합니다.
          </span>
        </div>
        <span className="text-[11px] font-semibold text-amber-800 bg-amber-200/70 px-2 py-0.5 rounded-full">
          상시 5인 {settings.isUnderFiveEmployees ? '미만' : '이상'} 사업장 설정 중
        </span>
      </div>

      {/* 3. 본문 탭 영역 */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
        {/* ================= TAB 1: 대시보드 & 법적알림 ================= */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* 오늘 매장 출근 현황 카드 */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
              <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                오늘 실시간 매장 현황
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {employees
                  .filter((e) => e.isActive)
                  .map((emp) => {
                    const shift = activeShifts[emp.id];
                    const isWorking = !!shift;
                    const workType = workTypes.find((w) => w.id === emp.workTypeId);

                    return (
                      <div
                        key={emp.id}
                        className={`p-4 rounded-2xl border ${
                          isWorking ? 'bg-emerald-50/50 border-emerald-300' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <span className="text-xs text-slate-500">{workType?.name}</span>
                            <h4 className="font-bold text-slate-900 text-base">{emp.name}</h4>
                          </div>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                              isWorking ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {isWorking ? '근무 중' : '대기/퇴근'}
                          </span>
                        </div>
                        {isWorking ? (
                          <div className="text-xs text-emerald-800 font-medium">
                            출근: <strong>{shift.checkInTime}</strong>
                            {shift.isCustom && <span className="ml-1 text-amber-700">(직접입력)</span>}
                          </div>
                        ) : (
                          <div className="text-xs text-slate-400">
                            계획: {emp.scheduledStartTime} ~ {emp.scheduledEndTime}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* 법적 리스크 & 알림 센터 (Alert Center) */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  <h2 className="text-base font-bold text-slate-900">
                    근로기준법 리스크 & 사전 알림 센터 ({alerts.length}건)
                  </h2>
                </div>
                <span className="text-xs text-slate-500">
                  문제가 발생하기 전 미리 조치할 수 있도록 시스템이 실시간 감지합니다.
                </span>
              </div>

              {alerts.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 rounded-2xl border border-slate-100">
                  <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-700">현재 감지된 노무 리스크가 없습니다!</p>
                  <p className="text-xs text-slate-400 mt-1">
                    최저임금, 휴게시간, 근무시간 기준이 모두 안전하게 준수되고 있습니다.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {alerts.map((alert) => {
                    const isDanger = alert.level === 'danger';
                    const isWarning = alert.level === 'warning';
                    const law = LABOR_LAWS.find((l) => l.id === alert.lawId);

                    return (
                      <div
                        key={alert.id}
                        className={`p-5 rounded-2xl border flex flex-col justify-between ${
                          isDanger
                            ? 'bg-rose-50/80 border-rose-200 text-rose-950'
                            : isWarning
                            ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                            : 'bg-blue-50/80 border-blue-200 text-blue-950'
                        }`}
                      >
                        <div>
                          <div className="flex justify-between items-start mb-2">
                            <span
                              className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                                isDanger
                                  ? 'bg-rose-600 text-white'
                                  : isWarning
                                  ? 'bg-amber-600 text-white'
                                  : 'bg-blue-600 text-white'
                              }`}
                            >
                              {isDanger ? '위험 (조치필요)' : isWarning ? '주의 (모니터링)' : '안내'}
                            </span>
                            {law && (
                              <button
                                onClick={() => setSelectedLawModal(law)}
                                className="text-xs font-semibold underline flex items-center gap-1 hover:opacity-80"
                              >
                                {law.title} 법령보기
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          <h4 className="font-bold text-sm mb-1">{alert.title}</h4>
                          <p className="text-xs leading-relaxed opacity-90">{alert.message}</p>
                        </div>

                        {/* 조기출근 등 승인 버튼이 필요한 경우 */}
                        {alert.recordId && (
                          <div className="mt-3 pt-2 border-t border-amber-200/60 flex justify-end">
                            <button
                              onClick={() => handleApproveRecord(alert.recordId)}
                              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-sm"
                            >
                              조기 근무 확인 및 승인
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 2: 출퇴근 기록 관리 ================= */}
        {activeTab === 'attendance' && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">전체 출퇴근 기록 및 수정 이력</h2>
                <p className="text-xs text-slate-500">
                  직원들이 타각한 모든 기록과 사장님의 수정 사유 로그가 투명하게 보존됩니다.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setNewManualRecord({
                      date: new Date().toISOString().split('T')[0],
                      empId: employees.filter((e) => e.isActive)[0]?.id || '',
                      checkInTime: '13:00',
                      checkOutTime: '18:00',
                      breakMinutes: 30,
                      reason: '',
                    })
                  }
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold shadow-sm"
                >
                  <Plus className="w-4 h-4 text-amber-400" />
                  누락된 기록 수동 등록
                </button>
                <a
                  href={settings.googleSheetDocUrl || "https://docs.google.com/spreadsheets/"}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold shadow-sm transition"
                  title="구글 스프레드시트 새 창 열기"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>구글시트 실시간 기록 보기</span>
                  <ExternalLink className="w-3.5 h-3.5 text-emerald-500" />
                </a>
                <button
                  onClick={handleDownloadExcel}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-300 shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  엑셀 파일로 다운로드
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">날짜</th>
                    <th className="py-3 px-3">직원명</th>
                    <th className="py-3 px-3">근무형태</th>
                    <th className="py-3 px-3">출근</th>
                    <th className="py-3 px-3">퇴근</th>
                    <th className="py-3 px-3">휴게</th>
                    <th className="py-3 px-3">실근무</th>
                    <th className="py-3 px-3">시급</th>
                    <th className="py-3 px-3">일급</th>
                    <th className="py-3 px-4">비고 / 수정이력</th>
                    <th className="py-3 px-3 text-center">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {attendanceRecords.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-8 text-center text-slate-400">
                        기록된 출퇴근 내역이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    // 날짜별 그룹핑 및 내림차순(최신순) 정렬
                    (() => {
                      const grouped = attendanceRecords.reduce((acc, r) => {
                        const d = r.date || '날짜 미지정';
                        if (!acc[d]) acc[d] = [];
                        acc[d].push(r);
                        return acc;
                      }, {});

                      const sortedDates = Object.keys(grouped).sort(
                        (a, b) => new Date(b) - new Date(a)
                      );

                      return sortedDates.map((dateStr) => {
                        const dayRecords = grouped[dateStr];
                        const totalDayHours = dayRecords.reduce(
                          (sum, r) => sum + (r.actualWorkHours || 0),
                          0
                        );
                        const dateObj = new Date(dateStr);
                        const dayOfWeek =
                          ['일', '월', '화', '수', '목', '금', '토'][dateObj.getDay()] || '';
                        const isWeekend =
                          dateObj.getDay() === 0 || dateObj.getDay() === 6;

                        return (
                          <React.Fragment key={dateStr}>
                            {/* [일별 시각적 구분선 & 날짜 헤더 라인] */}
                            <tr className="bg-amber-50/70 border-t-2 border-b border-amber-200/80">
                              <td colSpan={11} className="py-2.5 px-4">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                                    <span className="text-xs font-black text-slate-900 tracking-tight">
                                      📅 {dateStr}
                                      <span
                                        className={`ml-1 font-bold ${
                                          isWeekend ? 'text-rose-600' : 'text-slate-600'
                                        }`}
                                      >
                                        ({dayOfWeek}요일)
                                      </span>
                                    </span>
                                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-white border border-amber-200 font-bold text-amber-900 shadow-xs">
                                      근무 파트너 {dayRecords.length}명
                                    </span>
                                  </div>
                                  <div className="text-xs text-slate-600 font-semibold">
                                    당일 총 실근무시간: <strong className="text-emerald-700 font-bold">{totalDayHours.toFixed(1)}시간</strong>
                                  </div>
                                </div>
                              </td>
                            </tr>

                            {/* 당일 직원별 출퇴근 기록 행 */}
                            {dayRecords.map((r) => (
                              <tr key={r.id} className="hover:bg-slate-50/80 bg-white">
                                <td className="py-3 px-4 font-semibold text-slate-500">
                                  {r.date}
                                </td>
                                <td className="py-3 px-3 font-bold text-slate-900">
                                  {r.empName}
                                </td>
                                <td className="py-3 px-3 text-slate-500">{r.workType}</td>
                                <td className="py-3 px-3 font-semibold text-slate-800">
                                  {r.checkInTime}
                                </td>
                                <td className="py-3 px-3 font-semibold text-slate-800">
                                  {r.checkOutTime}
                                </td>
                                <td className="py-3 px-3 text-slate-500">
                                  {r.breakMinutes || 0}분
                                </td>
                                <td className="py-3 px-3 font-bold text-emerald-700">
                                  {r.actualWorkHours}h
                                </td>
                                <td className="py-3 px-3 text-slate-600">
                                  {(r.hourlyWage || 0).toLocaleString()}원
                                </td>
                                <td className="py-3 px-3 font-bold text-slate-900">
                                  {(r.dailyPay || 0).toLocaleString()}원
                                </td>
                                <td className="py-3 px-4 text-slate-500 max-w-xs truncate">
                                  {r.note || '-'}
                                </td>
                                <td className="py-3 px-3 text-center">
                                  <button
                                    onClick={() => {
                                      setEditingRecord({ ...r });
                                      setEditReason('');
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold shadow-xs"
                                  >
                                    수정
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </React.Fragment>
                        );
                      });
                    })()
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================= TAB 3: 월별 급여 정산 ================= */}
        {activeTab === 'payroll' && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-base font-bold text-slate-900">월별 급여 정산 및 주휴수당 승인</h2>
                <p className="text-xs text-slate-500">
                  매월 1일 ~ 말일 기준 정산이며, 10원 미만은 법적 기준에 맞춰 자동 절사됩니다.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="month"
                  value={settleMonth}
                  onChange={(e) => setSettleMonth(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-800"
                />
                <button
                  onClick={handleDownloadExcel}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  월 급여대장(.xlsx) 다운로드
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200 mb-6">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">직원명</th>
                    <th className="py-3.5 px-3">근무형태</th>
                    <th className="py-3.5 px-3">총 근로일수</th>
                    <th className="py-3.5 px-3">총 근로시간</th>
                    <th className="py-3.5 px-3">적용 시급</th>
                    <th className="py-3.5 px-3">기본급</th>
                    <th className="py-3.5 px-3">주휴수당 (개근승인)</th>
                    <th className="py-3.5 px-3">가산수당 (5인이상)</th>
                    <th className="py-3.5 px-3">연차미사용수당</th>
                    <th className="py-3.5 px-4 font-black text-amber-800">최종 지급 총액</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {getPayrollSummary().map((row) => (
                    <tr key={row.empId} className="hover:bg-slate-50">
                      <td className="py-3.5 px-4 font-bold text-slate-900">{row.empName}</td>
                      <td className="py-3.5 px-3 text-slate-500">{row.workType}</td>
                      <td className="py-3.5 px-3">{row.totalDays}일</td>
                      <td className="py-3.5 px-3 font-semibold">{row.totalWorkHours}시간</td>
                      <td className="py-3.5 px-3">{row.hourlyWage.toLocaleString()}원</td>
                      <td className="py-3.5 px-3 font-semibold">{row.baseSalary.toLocaleString()}원</td>
                      <td className="py-3.5 px-3">
                        {row.hasHolidayEligibility ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="checkbox"
                              checked={approvedWeeklyHolidays[row.empId] !== false}
                              onChange={(e) =>
                                setApprovedWeeklyHolidays((prev) => ({
                                  ...prev,
                                  [row.empId]: e.target.checked,
                                }))
                              }
                              className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                            />
                            <span className="font-bold text-blue-700">
                              {row.weeklyHolidayPay.toLocaleString()}원
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400">대상 아님</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3">
                        {settings.isUnderFiveEmployees ? (
                          <span className="text-slate-400">미적용(5인미만)</span>
                        ) : (
                          <span>{row.overtimePay.toLocaleString()}원</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="text-slate-400">0원 (2단계 확장)</span>
                      </td>
                      <td className="py-3.5 px-4 font-black text-sm text-amber-800">
                        {row.totalPay.toLocaleString()}원
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-relaxed">
              💡 <strong>주휴수당 지급 기준 안내:</strong> 근로기준법상 주 15시간 이상 근무자라도 약정한 근무일에 ‘개근’해야 주휴수당이 발생합니다. 사장님이 결근 여부를 확인한 후 체크박스를 통해 지급 여부를 최종 결정할 수 있습니다.
            </div>
          </div>
        )}

        {/* ================= TAB 4: 직원 & 근무형태 관리 ================= */}
        {activeTab === 'employees' && (
          <div className="space-y-6">
            {/* 직원 목록 및 등록 */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">직원 정보 관리 (3~4명)</h2>
                  <p className="text-xs text-slate-500">
                    2단계 연차 관리를 대비해 입사일, 생년월일, 주/1일 소정근로시간을 함께 관리합니다.
                  </p>
                </div>
                <button
                  onClick={() =>
                    setEditingEmp({
                      id: `EMP-${String(employees.length + 1).padStart(3, '0')}`,
                      name: '',
                      pin: '1234',
                      workTypeId: 'WT-01',
                      hourlyWage: settings.minWage,
                      hireDate: new Date().toISOString().split('T')[0],
                      birthDate: '2000-01-01',
                      contractWeeklyHours: 14,
                      contractDailyHours: 4.5,
                      scheduledDays: '월,수,금',
                      scheduledStartTime: '13:00',
                      scheduledEndTime: '17:30',
                      isActive: true,
                    })
                  }
                  className="flex items-center gap-1 px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold"
                >
                  <Plus className="w-4 h-4" />
                  새 직원 등록
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {employees.map((emp) => {
                  const workType = workTypes.find((w) => w.id === emp.workTypeId);
                  const isEmployed = emp.isActive !== false;

                  return (
                    <div
                      key={emp.id}
                      className={`p-5 rounded-2xl border transition ${
                        isEmployed
                          ? 'border-slate-200 bg-slate-50'
                          : 'border-slate-200 bg-slate-100/70 opacity-75'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold border ${workType?.badgeColor}`}>
                              {workType?.name}
                            </span>
                            <span
                              className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                                isEmployed
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : 'bg-slate-200 text-slate-600 border border-slate-300'
                              }`}
                            >
                              {isEmployed ? '재직 중 (키오스크 노출)' : '퇴사 (키오스크 숨김)'}
                            </span>
                            <span className="text-xs text-slate-400">PIN: {emp.pin}</span>
                          </div>
                          <h4 className="text-lg font-bold text-slate-900">{emp.name}</h4>
                        </div>

                        {/* 작업 버튼들 */}
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setEditingEmp({ ...emp })}
                            className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 shadow-sm"
                          >
                            수정
                          </button>
                          <button
                            onClick={() => {
                              const actionName = isEmployed ? '퇴사(키오스크 숨김)' : '재직(키오스크 노출)';
                              if (confirm(`'${emp.name}' 파트너를 ${actionName} 처리하시겠습니까?`)) {
                                const updated = employees.map((e) =>
                                  e.id === emp.id ? { ...e, isActive: !isEmployed } : e
                                );
                                onSaveEmployees(updated);
                              }
                            }}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold shadow-sm transition ${
                              isEmployed
                                ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
                                : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300'
                            }`}
                          >
                            {isEmployed ? '퇴사 처리' : '재직 복구'}
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`정말 '${emp.name}' 파트너 정보를 완전히 삭제하시겠습니까?\n(기존 출퇴근 기록은 유지됩니다)`)) {
                                const updated = employees.filter((e) => e.id !== emp.id);
                                onSaveEmployees(updated);
                              }
                            }}
                            className="p-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200"
                            title="완전 삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-0.5 text-xs text-slate-600 mt-2 bg-white/70 p-3 rounded-xl border border-slate-100">
                        <p>시급: <strong>{emp.hourlyWage.toLocaleString()}원</strong></p>
                        <p>스케줄: {emp.scheduledStartTime} ~ {emp.scheduledEndTime} ({emp.scheduledDays})</p>
                        <p>입사일: {emp.hireDate} (근속 {getTenureMonths(emp.hireDate)}개월)</p>
                        <p>소정근로시간: 주 {emp.contractWeeklyHours}h / 일 {emp.contractDailyHours}h</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 근무형태 템플릿 설정 */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
              <h2 className="text-base font-bold text-slate-900 mb-2">근무형태 기준시간 설정</h2>
              <p className="text-xs text-slate-500 mb-4">
                초단시간(주 15h 미만), 4대보험(월 60h) 등 매장 운영 기준을 사장님이 직접 조정할 수 있습니다.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {workTypes.map((wt) => (
                  <div key={wt.id} className="p-4 rounded-2xl border border-slate-200 bg-white">
                    <h4 className="font-bold text-slate-900 text-sm mb-1">{wt.name}</h4>
                    <p className="text-xs text-slate-500 mb-3">{wt.description}</p>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="bg-slate-50 p-2 rounded-lg text-center">
                        <span className="text-slate-400 block">주 계약시간</span>
                        <strong className="text-slate-800">{wt.weeklyTargetHours}시간</strong>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-lg text-center">
                        <span className="text-slate-400 block">주 최대선</span>
                        <strong className="text-rose-700">{wt.weeklyMaxHours}시간</strong>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-lg text-center">
                        <span className="text-slate-400 block">월 기준선</span>
                        <strong className="text-blue-700">{wt.monthlyTargetHours}시간</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 5: 시스템 설정 & 구글 연동 ================= */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
              <h2 className="text-base font-bold text-slate-900 mb-4">사업장 법적 기준 및 운영 설정</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 5인 미만 / 이상 스위치 */}
                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50">
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    상시 근로자 규모 (근로기준법 적용 범위)
                  </label>
                  <p className="text-xs text-slate-500 mb-3">
                    5인 이상으로 변경 시 연장·야간 가산수당(1.5배) 계산과 주 52시간 체크가 켜집니다.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onSaveSettings({ ...settings, isUnderFiveEmployees: true })}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${
                        settings.isUnderFiveEmployees
                          ? 'bg-amber-600 text-white shadow'
                          : 'bg-white border border-slate-200 text-slate-600'
                      }`}
                    >
                      5인 미만 사업장 (기본)
                    </button>
                    <button
                      type="button"
                      onClick={() => onSaveSettings({ ...settings, isUnderFiveEmployees: false })}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${
                        !settings.isUnderFiveEmployees
                          ? 'bg-amber-600 text-white shadow'
                          : 'bg-white border border-slate-200 text-slate-600'
                      }`}
                    >
                      상시 5인 이상 사업장
                    </button>
                  </div>
                </div>

                {/* 올해 최저임금 직접 입력 */}
                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50">
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    올해 법정 최저시급 (원)
                  </label>
                  <p className="text-xs text-slate-500 mb-3">
                    최저임금이 인상되면 직접 숫자를 변경하세요. 시스템 알림에 즉시 반영됩니다.
                  </p>
                  <input
                    type="number"
                    value={settings.minWage}
                    onChange={(e) =>
                      onSaveSettings({ ...settings, minWage: Number(e.target.value) })
                    }
                    className="w-full px-4 py-2 bg-white rounded-xl border border-slate-300 font-bold text-slate-900"
                  />
                </div>

                {/* 사장님 마스터 비밀번호 변경 */}
                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50">
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    사장님 마스터 PIN 번호 (4자리)
                  </label>
                  <p className="text-xs text-slate-500 mb-3">
                    관리자 화면 진입 시 요구되는 비밀번호입니다. (기본: 0000)
                  </p>
                  <input
                    type="password"
                    maxLength={4}
                    value={settings.adminPin}
                    onChange={(e) =>
                      onSaveSettings({ ...settings, adminPin: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-white rounded-xl border border-slate-300 font-bold text-slate-900 tracking-widest text-center text-lg"
                  />
                </div>

                {/* 연차 자율 부여 스위치 */}
                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50">
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    연차 자율 부여 여부 (2단계 대비)
                  </label>
                  <p className="text-xs text-slate-500 mb-3">
                    5인 미만이라도 사장님이 직원 복지 차원에서 연차를 줄 수 있도록 설정합니다.
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      onSaveSettings({
                        ...settings,
                        allowAnnualLeave: !settings.allowAnnualLeave,
                      })
                    }
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                      settings.allowAnnualLeave
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    연차 자율 부여: {settings.allowAnnualLeave ? '켜짐 (ON)' : '꺼짐 (OFF)'}
                  </button>
                </div>
              </div>
            </div>

            {/* 구글 스프레드시트 연동 설정 가이드 */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-5">
              <div>
                <h2 className="text-base font-bold text-slate-900 mb-1">구글 스프레드시트 실시간 연동 및 바로가기</h2>
                <p className="text-xs text-slate-500">
                  구글 시트 웹 주소와 Apps Script 연동 URL을 등록하면, 사이트 어디서든 구글 시트를 원클릭으로 열고 실시간 자동 저장이 가능합니다.
                </p>
              </div>

              {/* 1. 구글 스프레드시트 바로가기 웹 링크 */}
              <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    1. 내 구글 스프레드시트 바로가기 웹 주소 (브라우저 주소창 링크)
                  </label>
                  {settings.googleSheetDocUrl && (
                    <a
                      href={settings.googleSheetDocUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-bold text-emerald-800 hover:text-emerald-950 underline flex items-center gap-1"
                    >
                      지금 시트 열어보기 ↗
                    </a>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mb-2">
                  만드신 구글 시트의 인터넷 주소를 복사해 넣으시면, 상단 헤더의 <strong>[구글시트 바로가기]</strong> 버튼 클릭 시 내 시트가 새 창으로 바로 열립니다.
                </p>
                <input
                  type="url"
                  placeholder="https://docs.google.com/spreadsheets/d/XXXXXXXXX/edit"
                  value={settings.googleSheetDocUrl || ''}
                  onChange={(e) =>
                    onSaveSettings({ ...settings, googleSheetDocUrl: e.target.value })
                  }
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-medium text-slate-900 bg-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* 2. Apps Script 웹 앱 URL */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <label className="text-xs font-bold text-slate-800 block mb-1">
                  2. Google Apps Script 자동 동기화 웹 앱 URL (필수)
                </label>
                <p className="text-[11px] text-slate-500 mb-2">
                  직원이 출퇴근 버튼을 누르는 순간 구글 시트에 한 줄씩 실시간 자동 저장하기 위한 주소입니다.
                </p>
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://script.google.com/macros/s/XXXXX/exec"
                    value={settings.googleScriptUrl || ''}
                    onChange={(e) =>
                      onSaveSettings({ ...settings, googleScriptUrl: e.target.value })
                    }
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-medium text-slate-900 bg-white"
                  />
                  <button
                    onClick={onTestGoogleSync}
                    className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold whitespace-nowrap shadow-sm"
                  >
                    연결 테스트 전송
                  </button>
                </div>
              </div>

              {/* 쉬운 안내서 */}
              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-xs text-slate-700 space-y-2">
                <p className="font-bold text-amber-950">📋 비개발자 사장님을 위한 초간단 4단계 연결 방법</p>
                <ol className="list-decimal list-inside space-y-1 text-slate-600">
                  <li>구글 드라이브에서 새 <strong>'Google 스프레드시트'</strong>를 만들고 탭 이름을 <code>출퇴근기록</code>으로 지정합니다.</li>
                  <li>상단 메뉴의 <strong>[확장 프로그램] $\rightarrow$ [Apps Script]</strong>를 누릅니다.</li>
                  <li>아래 제공되는 연동 코드를 복사하여 붙여넣고 상단 [저장] 아이콘을 누릅니다.</li>
                  <li>오른쪽 상단 파란색 <strong>[배포] $\rightarrow$ [새 배포] $\rightarrow$ [웹 앱]</strong>을 선택하고 액세스를 '모든 사용자'로 배포 후 URL을 복사해 위에 넣으세요!</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 6: 근로 법령 바로가기 ================= */}
        {activeTab === 'laws' && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900">국가법령정보센터 공식 법령 원문 바로가기</h2>
              <p className="text-xs text-slate-500">
                인사/노무 분쟁을 예방하기 위해 근로기준법 및 최저임금법 핵심 조항을 언제든 클릭하여 원문을 확인할 수 있습니다.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {LABOR_LAWS.map((law) => (
                <div key={law.id} className="p-5 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-amber-50/40 transition">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded-full">
                      {law.title}
                    </span>
                    <a
                      href={law.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-slate-600 hover:text-slate-900 underline flex items-center gap-1"
                    >
                      원문보기
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm mb-1">{law.summary}</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">{law.detail}</p>
                </div>
              ))}
            </div>

            {/* 공식 상담 창구 안내 */}
            <div className="p-5 rounded-2xl bg-slate-900 text-white text-xs flex justify-between items-center">
              <div>
                <p className="font-bold text-amber-400 text-sm mb-1">고용노동부 공식 무료 상담 안내</p>
                <p className="text-slate-300">
                  궁금한 점은 고용노동부 고객상담센터 <strong>☎ 국번없이 1350</strong>으로 전화하시면 즉시 상담원 안내를 받으실 수 있습니다.
                </p>
              </div>
              <a
                href="https://www.moel.go.kr"
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold whitespace-nowrap"
              >
                고용노동부 홈페이지
              </a>
            </div>
          </div>
        )}
      </main>

      {/* 법령 상세 팝업 모달 */}
      {selectedLawModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-start mb-3">
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
                {selectedLawModal.title}
              </span>
              <button
                onClick={() => setSelectedLawModal(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                닫기
              </button>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">{selectedLawModal.summary}</h3>
            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-xl mb-4 border border-slate-200">
              {selectedLawModal.detail}
            </p>
            <div className="flex justify-end gap-2">
              <a
                href={selectedLawModal.url}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold flex items-center gap-1.5"
              >
                국가법령정보센터 원문 보기
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* 출퇴근 기록 수정 모달 */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              출퇴근 기록 수정 ({editingRecord.empName})
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              수정 시 수정 이력과 사유가 감사 로그로 구글 시트에 영구 보존됩니다.
            </p>

            <div className="space-y-3 mb-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">근무 일자</label>
                <input
                  type="date"
                  value={editingRecord.date}
                  onChange={(e) =>
                    setEditingRecord({ ...editingRecord, date: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-xl font-bold"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">출근 시각</label>
                <input
                  type="time"
                  value={editingRecord.checkInTime}
                  onChange={(e) =>
                    setEditingRecord({ ...editingRecord, checkInTime: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-xl font-bold"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">퇴근 시각</label>
                <input
                  type="time"
                  value={editingRecord.checkOutTime}
                  onChange={(e) =>
                    setEditingRecord({ ...editingRecord, checkOutTime: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-xl font-bold"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">휴게시간 (분)</label>
                <input
                  type="number"
                  value={editingRecord.breakMinutes || 0}
                  onChange={(e) =>
                    setEditingRecord({
                      ...editingRecord,
                      breakMinutes: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border rounded-xl font-bold"
                />
              </div>
              <div>
                <label className="font-bold text-rose-700 block mb-1">
                  수정 사유 (필수 입력)
                </label>
                <input
                  type="text"
                  placeholder="예: 마감 지연 사유 확인 후 연장 인정"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  className="w-full px-3 py-2 border border-rose-300 rounded-xl bg-rose-50/40 text-slate-900 font-medium"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEditingRecord(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100"
              >
                취소
              </button>
              <button
                onClick={handleSaveEditRecord}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
              >
                수정 완료 및 저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 누락된 출퇴근 기록 수동 등록 모달 (사장 전용) */}
      {newManualRecord && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="flex justify-between items-start mb-2">
              <div>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  사장님 전용 소급 입력
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-1">
                  누락된 출퇴근 기록 수동 등록
                </h3>
              </div>
              <button
                onClick={() => setNewManualRecord(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              직원이 타각을 깜빡한 날짜와 시간을 입력하면 급여 및 주휴수당에 즉시 반영됩니다.
            </p>

            <div className="space-y-3 mb-5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">직원 선택</label>
                <select
                  value={newManualRecord.empId}
                  onChange={(e) =>
                    setNewManualRecord({ ...newManualRecord, empId: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-xl font-bold bg-white"
                >
                  {employees
                    .filter((e) => e.isActive)
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} ({workTypes.find((w) => w.id === e.workTypeId)?.name})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">근무 일자 (날짜 지정)</label>
                <input
                  type="date"
                  value={newManualRecord.date}
                  onChange={(e) =>
                    setNewManualRecord({ ...newManualRecord, date: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-xl font-bold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">출근 시각</label>
                  <input
                    type="time"
                    value={newManualRecord.checkInTime}
                    onChange={(e) =>
                      setNewManualRecord({ ...newManualRecord, checkInTime: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-xl font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">퇴근 시각</label>
                  <input
                    type="time"
                    value={newManualRecord.checkOutTime}
                    onChange={(e) =>
                      setNewManualRecord({ ...newManualRecord, checkOutTime: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-xl font-bold text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">휴게시간 (분)</label>
                <input
                  type="number"
                  value={newManualRecord.breakMinutes}
                  onChange={(e) =>
                    setNewManualRecord({
                      ...newManualRecord,
                      breakMinutes: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border rounded-xl font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="font-bold text-amber-900 block mb-1">
                  수동 등록 사유 (필수 입력)
                </label>
                <input
                  type="text"
                  placeholder="예: 어제 출근 타각 누락 사유 확인 후 수동 입력"
                  value={newManualRecord.reason}
                  onChange={(e) =>
                    setNewManualRecord({ ...newManualRecord, reason: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-amber-300 rounded-xl bg-amber-50/50 text-slate-900 font-medium"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setNewManualRecord(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100"
              >
                취소
              </button>
              <button
                onClick={handleSaveManualRecord}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-black text-white shadow-sm"
              >
                기록 등록 완료
              </button>
            </div>
          </div>
        </div>
      )}
      {editingEmp && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              직원 정보 설정 ({editingEmp.name || '새 직원'})
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              기본 계약 정보와 2단계 연차 산정을 위한 필수 정보를 입력하세요.
            </p>

            <div className="grid grid-cols-2 gap-3 text-xs mb-4">
              <div>
                <label className="font-bold text-slate-700 block mb-1">이름</label>
                <input
                  type="text"
                  value={editingEmp.name}
                  onChange={(e) => setEditingEmp({ ...editingEmp, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl font-bold"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">개인 PIN (4자리)</label>
                <input
                  type="text"
                  maxLength={4}
                  value={editingEmp.pin}
                  onChange={(e) => setEditingEmp({ ...editingEmp, pin: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl font-bold text-center"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">근무형태</label>
                <select
                  value={editingEmp.workTypeId}
                  onChange={(e) =>
                    setEditingEmp({ ...editingEmp, workTypeId: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-xl font-bold bg-white"
                >
                  {workTypes.map((wt) => (
                    <option key={wt.id} value={wt.id}>
                      {wt.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">시급 (원)</label>
                <input
                  type="number"
                  value={editingEmp.hourlyWage}
                  onChange={(e) =>
                    setEditingEmp({
                      ...editingEmp,
                      hourlyWage: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border rounded-xl font-bold"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">입사일자 (2단계 연차 필수)</label>
                <input
                  type="date"
                  value={editingEmp.hireDate}
                  onChange={(e) =>
                    setEditingEmp({ ...editingEmp, hireDate: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-xl font-bold"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">생년월일 (18세 미만 판별)</label>
                <input
                  type="date"
                  value={editingEmp.birthDate}
                  onChange={(e) =>
                    setEditingEmp({ ...editingEmp, birthDate: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-xl font-bold"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">계획 출근시각</label>
                <input
                  type="time"
                  value={editingEmp.scheduledStartTime}
                  onChange={(e) =>
                    setEditingEmp({
                      ...editingEmp,
                      scheduledStartTime: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border rounded-xl font-bold"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">계획 퇴근시각</label>
                <input
                  type="time"
                  value={editingEmp.scheduledEndTime}
                  onChange={(e) =>
                    setEditingEmp({
                      ...editingEmp,
                      scheduledEndTime: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border rounded-xl font-bold"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">주 소정근로시간(h)</label>
                <input
                  type="number"
                  step="0.5"
                  value={editingEmp.contractWeeklyHours}
                  onChange={(e) =>
                    setEditingEmp({
                      ...editingEmp,
                      contractWeeklyHours: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border rounded-xl font-bold"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">1일 소정근로시간(h)</label>
                <input
                  type="number"
                  step="0.5"
                  value={editingEmp.contractDailyHours}
                  onChange={(e) =>
                    setEditingEmp({
                      ...editingEmp,
                      contractDailyHours: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border rounded-xl font-bold"
                />
              </div>
              <div className="col-span-2 bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800 block text-xs">재직 상태 (키오스크 노출 여부)</span>
                  <span className="text-[11px] text-slate-500">퇴사한 직원은 체크를 해제하면 키오스크 화면에서 숨겨집니다.</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingEmp.isActive !== false}
                    onChange={(e) => setEditingEmp({ ...editingEmp, isActive: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEditingEmp(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100"
              >
                취소
              </button>
              <button
                onClick={() => {
                  const exists = employees.some((e) => e.id === editingEmp.id);
                  let updated;
                  if (exists) {
                    updated = employees.map((e) =>
                      e.id === editingEmp.id ? editingEmp : e
                    );
                  } else {
                    updated = [...employees, editingEmp];
                  }
                  onSaveEmployees(updated);
                  setEditingEmp(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
              >
                저장 완료
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
