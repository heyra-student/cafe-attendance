import React, { useState } from 'react';
import { X, Delete, Lock } from 'lucide-react';

export default function PinModal({ employee, onClose, onSuccess, title = "비밀번호 입력" }) {
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [attemptCount, setAttemptCount] = useState(0);

  const handleKeyPress = (num) => {
    if (pin.length < 4) {
      const nextPin = pin + num;
      setPin(nextPin);
      setErrorMsg('');

      if (nextPin.length === 4) {
        // PIN 검증
        if (nextPin === employee.pin) {
          onSuccess();
        } else {
          const nextAttempts = attemptCount + 1;
          setAttemptCount(nextAttempts);
          if (nextAttempts >= 5) {
            setErrorMsg('5회 연속 불일치로 잠겼습니다. 사장님께 문의하세요.');
          } else {
            setErrorMsg(`PIN 번호가 일치하지 않습니다. (${nextAttempts}/5)`);
          }
          setTimeout(() => setPin(''), 300);
        }
      }
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
    setErrorMsg('');
  };

  const handleClear = () => {
    setPin('');
    setErrorMsg('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 text-center border border-slate-100 animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-amber-100 text-amber-800 font-bold flex items-center justify-center text-sm">
              <Lock className="w-4 h-4" />
            </span>
            <span className="font-semibold text-slate-800 text-sm">{title}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <h3 className="text-xl font-bold text-slate-900 mb-1">
          {employee.name} 파트너님
        </h3>
        <p className="text-xs text-slate-500 mb-6">개인 비밀번호(PIN 4자리)를 입력하세요.</p>

        {/* PIN 마스킹 표시 */}
        <div className="flex justify-center gap-3 mb-6">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className={`w-4 h-4 rounded-full transition-all duration-150 ${
                idx < pin.length ? 'bg-amber-600 scale-110' : 'bg-slate-200'
              }`}
            />
          ))}
        </div>

        {errorMsg && (
          <p className="text-xs font-medium text-rose-600 mb-4 animate-shake">
            {errorMsg}
          </p>
        )}

        {/* 숫자 키패드 */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              onClick={() => handleKeyPress(String(num))}
              disabled={attemptCount >= 5}
              className="h-14 rounded-2xl bg-slate-50 hover:bg-slate-100 active:bg-amber-50 text-2xl font-bold text-slate-800 transition shadow-sm border border-slate-200"
            >
              {num}
            </button>
          ))}
          <button
            onClick={handleClear}
            className="h-14 rounded-2xl bg-slate-50 hover:bg-slate-100 text-sm font-semibold text-slate-500 border border-slate-200"
          >
            전체취소
          </button>
          <button
            onClick={() => handleKeyPress('0')}
            disabled={attemptCount >= 5}
            className="h-14 rounded-2xl bg-slate-50 hover:bg-slate-100 active:bg-amber-50 text-2xl font-bold text-slate-800 transition shadow-sm border border-slate-200"
          >
            0
          </button>
          <button
            onClick={handleDelete}
            className="h-14 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center justify-center border border-slate-200"
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
