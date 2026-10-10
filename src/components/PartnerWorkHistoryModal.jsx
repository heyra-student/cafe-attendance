import React, { useState } from 'react';
import { X, Calendar, ChevronLeft, ChevronRight, Clock, Award } from 'lucide-react';
import { formatMinutesToHours } from '../utils/calculator';

export default function PartnerWorkHistoryModal({
  employee,
  workType,
  attendanceRecords,
  onClose,
}) {
  const today = new Date();
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1); // 1-12

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedYear((y) => y - 1);
      setSelectedMonth(12);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedYear((y) => y + 1);
      setSelectedMonth(1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  const monthPrefix = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

  // 해당 직원의 해당 월 출퇴근 기록 필터링 및 날짜 오름차순 정렬
  const monthlyRecords = attendanceRecords
    .filter((r) => r.empId === employee.id && r.date?.startsWith(monthPrefix))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  // 일별 누적시간 계산
  let runningMinutes = 0;
  const recordsWithCumulative = monthlyRecords.map((r) => {
    const dailyMin = Math.round((r.actualWorkHours || 0) * 60);
    runningMinutes += dailyMin;
    return {
      ...r,
      dailyMinutes: dailyMin,
      cumulativeMinutes: runningMinutes,
    };
  });

  const totalMonthlyMinutes = runningMinutes;
  const targetMonthlyMinutes = (workType?.monthlyTargetHours || 60) * 60;
  const remainingMonthlyMinutes = Math.max(0, targetMonthlyMinutes - totalMonthlyMinutes);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 animate-in fade-in zoom-in duration-150 flex flex-col max-h-[90vh]">
        {/* 헤더 */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold border ${workType?.badgeColor || 'bg-slate-100 text-slate-700'}`}>
                {workType?.name}
              </span>
              <span className="text-xs text-slate-400">주 {employee.contractWeeklyHours}시간 기준</span>
            </div>
            <h3 className="text-xl font-bold text-slate-900">
              {employee.name} 파트너 근무 시간표
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 월 선택 컨트롤 */}
        <div className="flex items-center justify-between bg-slate-50 px-4 py-2.5 rounded-2xl mb-4 border border-slate-200">
          <button
            onClick={handlePrevMonth}
            className="p-1.5 rounded-xl hover:bg-white text-slate-600 hover:text-slate-900 shadow-xs"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <Calendar className="w-4 h-4 text-amber-600" />
            <span>{selectedYear}년 {selectedMonth}월</span>
          </div>
          <button
            onClick={handleNextMonth}
            className="p-1.5 rounded-xl hover:bg-white text-slate-600 hover:text-slate-900 shadow-xs"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* 상단 월 요약 카드 (금액 일체 미노출) */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-amber-50/70 p-3 rounded-2xl border border-amber-200 text-center">
            <span className="text-[11px] text-slate-500 block mb-0.5 font-medium">총 근무일수</span>
            <strong className="text-base font-extrabold text-amber-900">{monthlyRecords.length}일</strong>
          </div>
          <div className="bg-emerald-50/70 p-3 rounded-2xl border border-emerald-200 text-center">
            <span className="text-[11px] text-slate-500 block mb-0.5 font-medium">당월 누적시간</span>
            <strong className="text-base font-extrabold text-emerald-800">
              {formatMinutesToHours(totalMonthlyMinutes)}
            </strong>
          </div>
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-center">
            <span className="text-[11px] text-slate-500 block mb-0.5 font-medium">월 기준 잔여</span>
            <strong className="text-base font-extrabold text-slate-700">
              {formatMinutesToHours(remainingMonthlyMinutes)}
            </strong>
          </div>
        </div>

        {/* 일별 근무 내역 테이블 */}
        <div className="flex-1 overflow-y-auto rounded-2xl border border-slate-200 mb-4">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100/80 text-slate-700 font-bold sticky top-0 border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">근무일자</th>
                <th className="py-2.5 px-2">근무시간</th>
                <th className="py-2.5 px-2">휴게</th>
                <th className="py-2.5 px-2 text-right">당일시간</th>
                <th className="py-2.5 px-3 text-right font-extrabold text-emerald-700">누적시간</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recordsWithCumulative.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-400">
                    해당 월에 기록된 출퇴근 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                recordsWithCumulative.map((r) => {
                  const dateObj = new Date(r.date);
                  const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][dateObj.getDay()];
                  const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

                  return (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-slate-800">{r.date.slice(5)}</span>
                        <span className={`ml-1 text-[11px] font-bold ${isWeekend ? 'text-rose-500' : 'text-slate-400'}`}>
                          ({dayOfWeek})
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-slate-600 font-medium">
                        {r.checkInTime} ~ {r.checkOutTime}
                      </td>
                      <td className="py-2.5 px-2 text-slate-400">
                        {r.breakMinutes || 0}분
                      </td>
                      <td className="py-2.5 px-2 text-right font-bold text-slate-800">
                        {formatMinutesToHours(r.dailyMinutes)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-emerald-700">
                        {formatMinutesToHours(r.cumulativeMinutes)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 안내 및 닫기 버튼 */}
        <div className="flex justify-between items-center text-xs">
          <span className="text-[11px] text-slate-400">
            * 시급 및 급여 금액은 사장님 관리자 모드에서만 조회됩니다.
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs shadow-sm transition"
          >
            확인 완료
          </button>
        </div>
      </div>
    </div>
  );
}
