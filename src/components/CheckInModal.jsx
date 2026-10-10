import React, { useState } from 'react';
import { X, Clock, AlertTriangle, ArrowRight, CheckCircle2, Edit3, Calendar } from 'lucide-react';
import { formatMinutesToHours } from '../utils/calculator';

export default function CheckInModal({
  employee,
  workType,
  weeklyStats,
  monthlyStats,
  onClose,
  onConfirmCheckIn,
  onOpenHistory,
}) {
  // 오늘 계획된 시간 (기본값)
  const defaultStartTime = employee.scheduledStartTime || "13:00";
  const defaultEndTime = employee.scheduledEndTime || "18:00";

  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customTime, setCustomTime] = useState(defaultStartTime);

  // 예정 근무 시간 (분)
  const [defH, defM] = defaultStartTime.split(':').map(Number);
  const [endH, endM] = defaultEndTime.split(':').map(Number);
  const plannedDurationMinutes = Math.max(0, (endH * 60 + endM) - (defH * 60 + defM));

  // 주간 남은 시간 초과 여부 체크
  const willExceedWeekly = plannedDurationMinutes > weeklyStats.remainingMinutes;
  const isCloseWeekly = weeklyStats.remainingMinutes <= 120; // 2시간 전

  const handleStandardCheckIn = () => {
    onConfirmCheckIn({
      time: defaultStartTime,
      isCustom: false,
      plannedTime: defaultStartTime,
    });
  };

  const handleCustomCheckIn = () => {
    if (!customTime) return;
    onConfirmCheckIn({
      time: customTime,
      isCustom: true,
      plannedTime: defaultStartTime,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-slate-100 animate-in fade-in zoom-in duration-200">
        {/* 헤더 */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${workType?.badgeColor || 'bg-slate-100 text-slate-700'}`}>
                {workType?.name || '근무형태'}
              </span>
              <span className="text-xs text-slate-400">계약 주 {employee.contractWeeklyHours}시간</span>
            </div>
            <h3 className="text-2xl font-bold text-slate-900">{employee.name} 파트너님</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 주간 및 월간 남은 시간 요약 (금액 일체 미노출) */}
        <div className="bg-slate-50 rounded-2xl p-4 mb-4 border border-slate-200">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-semibold text-slate-600">이번 주 누적 근로시간</span>
            <span className="text-sm font-bold text-slate-800">
              {formatMinutesToHours(weeklyStats.usedMinutes)} / {workType?.weeklyMaxHours}시간
            </span>
          </div>
          {/* 프로그레스 바 */}
          <div className="w-full bg-slate-200 rounded-full h-2 mb-3 overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all ${
                weeklyStats.remainingMinutes <= 0
                  ? 'bg-rose-500'
                  : isCloseWeekly
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{
                width: `${Math.min(100, (weeklyStats.usedMinutes / (workType?.weeklyMaxHours * 60 || 1)) * 100)}%`,
              }}
            />
          </div>

          <div className="flex justify-between text-xs pt-1 border-t border-slate-200/60">
            <span className="text-slate-500">주 기준까지 남은 시간:</span>
            <span className={`font-bold ${weeklyStats.remainingMinutes <= 120 ? 'text-amber-700' : 'text-emerald-700'}`}>
              {formatMinutesToHours(weeklyStats.remainingMinutes)} 남음
            </span>
          </div>
          <div className="flex justify-between text-xs pt-1">
            <span className="text-slate-500">월 기준({workType?.monthlyTargetHours}h)까지 남은 시간:</span>
            <span className="font-bold text-slate-700">
              {formatMinutesToHours(monthlyStats.remainingMinutes)} 남음
            </span>
          </div>

          {onOpenHistory && (
            <div className="pt-2.5 mt-2 border-t border-slate-200/80 flex justify-end">
              <button
                type="button"
                onClick={onOpenHistory}
                className="text-xs font-bold text-amber-800 hover:text-amber-900 flex items-center gap-1 hover:underline py-0.5"
              >
                <Calendar className="w-3.5 h-3.5" />
                나의 이번 달 일별 근무시간·누적시간 확인 &gt;
              </button>
            </div>
          )}
        </div>

        {/* 기준 초과 경고 배너 */}
        {willExceedWeekly && (
          <div className="mb-4 p-3 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 leading-relaxed">
              <span className="font-bold">⚠️ 기준시간 초과 주의</span>
              <p className="mt-0.5">
                오늘 예정 근무({formatMinutesToHours(plannedDurationMinutes)})를 마치면 주 기준({workType?.weeklyMaxHours}h)을 초과할 수 있습니다. 스케줄을 확인 후 출근하세요.
              </p>
            </div>
          </div>
        )}

        {/* 출근 시각 설정 영역 */}
        {!isCustomMode ? (
          <div className="space-y-3">
            <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-800">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">오늘 계획된 출근 시각</p>
                  <p className="text-xl font-bold text-slate-900">{defaultStartTime}</p>
                </div>
              </div>
              <button
                onClick={() => setIsCustomMode(true)}
                className="text-xs font-semibold text-amber-800 hover:text-amber-900 underline flex items-center gap-1"
              >
                <Edit3 className="w-3.5 h-3.5" />
                시간 직접 변경
              </button>
            </div>

            <button
              onClick={handleStandardCheckIn}
              className="w-full py-4 rounded-2xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold text-lg shadow-lg shadow-amber-600/20 transition flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-5 h-5" />
              계획대로 출근하기 ({defaultStartTime})
            </button>
            <p className="text-[11px] text-center text-slate-400">
              * 일찍 오셨더라도 이 버튼을 누르면 {defaultStartTime}부터 근무가 공식 인정됩니다.
            </p>
          </div>
        ) : (
          <div className="space-y-3 p-4 rounded-2xl bg-amber-50/70 border border-amber-200">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-bold text-amber-900 flex items-center gap-1">
                <Edit3 className="w-3.5 h-3.5" />
                조기 출근 등 시간 직접 입력
              </span>
              <button
                onClick={() => setIsCustomMode(false)}
                className="text-xs text-slate-500 hover:underline"
              >
                취소 (계획대로)
              </button>
            </div>

            <p className="text-xs text-slate-600">
              오픈 준비 등으로 실제로 일찍 업무를 시작해야 한다면 실제 시각을 입력하세요. (사장님께 알림 전달)
            </p>

            <div className="flex items-center gap-2">
              <input
                type="time"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                className="flex-1 px-4 py-3 rounded-xl border border-slate-300 text-lg font-bold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <button
              onClick={handleCustomCheckIn}
              className="w-full py-3.5 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-base transition flex items-center justify-center gap-2"
            >
              <span>{customTime} 출근 확정하기</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
