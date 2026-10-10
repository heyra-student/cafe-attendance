import React, { useState, useEffect } from 'react';
import { X, Coffee, CheckCircle2, AlertCircle, Plus, Minus } from 'lucide-react';
import {
  timeToMinutes,
  minutesToTime,
  getRecommendedBreakMinutes,
  formatMinutesToHours,
} from '../utils/calculator';

export default function CheckOutModal({
  employee,
  shift,
  onClose,
  onConfirmCheckOut,
}) {
  const currentTimeStr = minutesToTime(
    new Date().getHours() * 60 + new Date().getMinutes()
  );

  // 체류시간 계산
  const startMin = timeToMinutes(shift.checkInTime);
  const currentMin = timeToMinutes(currentTimeStr);
  const stayMinutes = Math.max(0, currentMin - startMin);

  // 법정 권장 휴게시간 자동 계산
  const recommendedBreak = getRecommendedBreakMinutes(stayMinutes);
  const [breakMinutes, setBreakMinutes] = useState(recommendedBreak);

  // 실근무시간
  const actualWorkMinutes = Math.max(0, stayMinutes - breakMinutes);

  const handleAdjustBreak = (delta) => {
    setBreakMinutes((prev) => Math.max(0, prev + delta));
  };

  const handleConfirm = () => {
    onConfirmCheckOut({
      checkOutTime: currentTimeStr,
      breakMinutes,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-slate-100 animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center mb-4">
          <div>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
              근무 중
            </span>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{employee.name} 파트너님</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 오늘 근무 현황 */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
            <span className="text-xs text-slate-500">출근 시각</span>
            <p className="text-lg font-bold text-slate-900">{shift.checkInTime}</p>
          </div>
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
            <span className="text-xs text-slate-500">현재 퇴근 시각</span>
            <p className="text-lg font-bold text-slate-900">{currentTimeStr}</p>
          </div>
        </div>

        {/* 휴게시간 확인 및 수정 (PRD 핵심 요구사항) */}
        <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Coffee className="w-4 h-4 text-amber-700" />
            <span className="text-xs font-bold text-amber-900">오늘 휴게(휴식)시간 확인</span>
          </div>

          <p className="text-xs text-slate-600 mb-3 leading-relaxed">
            체류시간({formatMinutesToHours(stayMinutes)}) 기준 법정 권장 휴게시간인{' '}
            <strong className="text-amber-800">{recommendedBreak}분</strong>으로 기본 설정되었습니다. 실제 쉰 시간과 다르다면 조정하세요.
          </p>

          <div className="flex items-center justify-between bg-white px-4 py-3 rounded-xl border border-slate-300">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleAdjustBreak(-10)}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-slate-700 active:scale-95"
              >
                <Minus className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleAdjustBreak(-5)}
                className="px-2 py-1 text-xs rounded-md bg-slate-100 hover:bg-slate-200 font-semibold text-slate-700"
              >
                -5분
              </button>
            </div>

            <div className="text-center">
              <span className="text-2xl font-extrabold text-slate-900">{breakMinutes}</span>
              <span className="text-xs font-semibold text-slate-500 ml-1">분</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleAdjustBreak(5)}
                className="px-2 py-1 text-xs rounded-md bg-slate-100 hover:bg-slate-200 font-semibold text-slate-700"
              >
                +5분
              </button>
              <button
                type="button"
                onClick={() => handleAdjustBreak(10)}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-slate-700 active:scale-95"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* 오늘 인정될 실근무시간 요약 */}
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 mb-5 flex justify-between items-center">
          <span className="text-xs font-bold text-emerald-900">오늘 인정될 실근무시간</span>
          <span className="text-lg font-black text-emerald-800">
            {formatMinutesToHours(actualWorkMinutes)}
          </span>
        </div>

        {/* 퇴근 확정 버튼 */}
        <button
          onClick={handleConfirm}
          className="w-full py-4 rounded-2xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold text-lg shadow-lg shadow-rose-600/20 transition flex items-center justify-center gap-2"
        >
          <CheckCircle2 className="w-5 h-5" />
          오늘 근무 퇴근 완료하기
        </button>
      </div>
    </div>
  );
}
