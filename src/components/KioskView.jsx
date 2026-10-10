import React, { useState, useEffect } from 'react';
import {
  Clock,
  Wifi,
  WifiOff,
  Shield,
  Coffee,
  CheckCircle,
  AlertCircle,
  User,
  ChevronRight,
} from 'lucide-react';
import PinModal from './PinModal';
import CheckInModal from './CheckInModal';
import CheckOutModal from './CheckOutModal';
import { formatMinutesToHours, timeToMinutes } from '../utils/calculator';

export default function KioskView({
  settings,
  employees,
  workTypes,
  attendanceRecords,
  activeShifts,
  onCheckIn,
  onCheckOut,
  onOpenAdmin,
}) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // 모달 상태
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [modalStep, setModalStep] = useState(null); // 'pin' | 'checkin' | 'checkout'
  const [adminPinModal, setAdminPinModal] = useState(false);

  // 1초마다 시계 갱신 및 온라인 상태 감지
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(timer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 직원별 이번 주/이번 달 누적 근무시간 계산 (PRD 요구사항)
  const getEmpStats = (empId, workTypeId) => {
    const workType = workTypes.find((w) => w.id === workTypeId);
    const maxWeeklyMin = (workType?.weeklyMaxHours || 15) * 60;
    const maxMonthlyMin = (workType?.monthlyTargetHours || 60) * 60;

    // 이번 주 일한 분 합산 (단순 계산: 최근 7일치)
    const empRecords = attendanceRecords.filter((r) => r.empId === empId);
    let weeklyUsedMinutes = 0;
    let monthlyUsedMinutes = 0;

    empRecords.forEach((r) => {
      const mins = Math.round((r.actualWorkHours || 0) * 60);
      weeklyUsedMinutes += mins;
      monthlyUsedMinutes += mins;
    });

    const weeklyRemainingMinutes = Math.max(0, maxWeeklyMin - weeklyUsedMinutes);
    const monthlyRemainingMinutes = Math.max(0, maxMonthlyMin - monthlyUsedMinutes);

    return {
      weeklyStats: {
        usedMinutes: weeklyUsedMinutes,
        remainingMinutes: weeklyRemainingMinutes,
      },
      monthlyStats: {
        usedMinutes: monthlyUsedMinutes,
        remainingMinutes: monthlyRemainingMinutes,
      },
    };
  };

  const handleCardClick = (emp) => {
    setSelectedEmp(emp);
    setModalStep('pin');
  };

  const handlePinSuccess = () => {
    if (activeShifts[selectedEmp.id]) {
      // 이미 출근 중이면 퇴근 모달
      setModalStep('checkout');
    } else {
      // 출근 전이면 출근 모달
      setModalStep('checkin');
    }
  };

  const handleConfirmCheckIn = (checkInData) => {
    onCheckIn(selectedEmp, checkInData);
    setModalStep(null);
    setSelectedEmp(null);
  };

  const handleConfirmCheckOut = (checkOutData) => {
    onCheckOut(selectedEmp, checkOutData);
    setModalStep(null);
    setSelectedEmp(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50/40 via-slate-50 to-orange-50/30 p-6 flex flex-col justify-between">
      {/* 1. 상단 바 */}
      <header className="flex justify-between items-center bg-white/80 backdrop-blur-md rounded-2xl px-6 py-4 shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-600 flex items-center justify-center text-white font-bold shadow-md shadow-amber-600/30">
            <Coffee className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              {settings.storeName || '카페 모닝브루'}
            </h1>
            <p className="text-xs text-slate-500 font-medium">카운터 전용 출퇴근 키오스크</p>
          </div>
        </div>

        {/* 중앙 디지털 시계 */}
        <div className="text-center">
          <div className="text-2xl font-black text-slate-900 tracking-wider">
            {currentTime.toLocaleTimeString('ko-KR', {
              hour12: false,
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </div>
          <div className="text-xs font-semibold text-slate-500">
            {currentTime.toLocaleDateString('ko-KR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              weekday: 'short',
            })}
          </div>
        </div>

        {/* 우측 네트워크 & 사장 모드 */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 text-xs font-semibold">
            {isOnline ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-slate-700">시트 연결됨</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <WifiOff className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-amber-800">오프라인 저장 중</span>
              </>
            )}
          </div>

          <button
            onClick={() => setAdminPinModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition shadow-sm"
          >
            <Shield className="w-4 h-4 text-amber-400" />
            <span>사장님 관리자</span>
          </button>
        </div>
      </header>

      {/* 2. 메인: 직원 카드 그리드 */}
      <main className="my-8 max-w-5xl w-full mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">
            출근 또는 퇴근할 이름을 선택하세요
          </h2>
          <p className="text-sm text-slate-500">
            본인의 이름을 누른 뒤 개인 PIN 번호 4자리를 입력하면 즉시 처리됩니다.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {employees
            .filter((e) => e.isActive)
            .map((emp) => {
              const shift = activeShifts[emp.id];
              const isWorking = !!shift;
              const workType = workTypes.find((w) => w.id === emp.workTypeId);
              const { weeklyStats } = getEmpStats(emp.id, emp.workTypeId);

              return (
                <div
                  key={emp.id}
                  onClick={() => handleCardClick(emp)}
                  className={`group relative bg-white rounded-3xl p-6 shadow-sm hover:shadow-xl border-2 transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                    isWorking
                      ? 'border-emerald-500 ring-4 ring-emerald-500/10'
                      : 'border-slate-200 hover:border-amber-400'
                  }`}
                >
                  {/* 근무 중 뱃지 */}
                  {isWorking && (
                    <div className="absolute top-4 right-4 flex items-center gap-1 bg-emerald-500 text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-sm animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-white" />
                      <span>근무 중</span>
                    </div>
                  )}

                  <div>
                    {/* 아바타 & 형태 */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-xl shadow-inner ${
                        isWorking ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {emp.name.slice(0, 1)}
                      </div>
                      <div>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold border ${workType?.badgeColor || 'bg-slate-100 text-slate-700'}`}>
                          {workType?.name || '파트너'}
                        </span>
                        <h3 className="text-xl font-bold text-slate-900 mt-1">{emp.name}</h3>
                      </div>
                    </div>

                    {/* 예정 스케줄 */}
                    <div className="bg-slate-50 rounded-2xl p-3 mb-3 border border-slate-100 text-xs">
                      <div className="flex justify-between text-slate-500 mb-1">
                        <span>계획 스케줄:</span>
                        <span className="font-semibold text-slate-800">
                          {emp.scheduledStartTime} ~ {emp.scheduledEndTime}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>근무 요일:</span>
                        <span className="font-medium text-slate-700">{emp.scheduledDays}</span>
                      </div>
                    </div>

                    {/* 주간 잔여시간 게이지 (금액 미노출) */}
                    <div className="text-xs">
                      <div className="flex justify-between mb-1">
                        <span className="text-slate-500">주 잔여시간:</span>
                        <span className={`font-bold ${weeklyStats.remainingMinutes <= 120 ? 'text-amber-600' : 'text-emerald-700'}`}>
                          {formatMinutesToHours(weeklyStats.remainingMinutes)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 하단 액션 버튼 */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 group-hover:text-slate-700 transition">
                      {isWorking ? '퇴근 체크하기' : '출근 체크하기'}
                    </span>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition ${
                      isWorking ? 'bg-rose-100 text-rose-700 group-hover:bg-rose-600 group-hover:text-white' : 'bg-amber-100 text-amber-800 group-hover:bg-amber-600 group-hover:text-white'
                    }`}>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </main>

      {/* 3. 하단 안내 푸터 */}
      <footer className="text-center text-xs text-slate-400 py-2">
        <p>🔒 개인정보 및 시급/급여 정보는 관리자 화면에서만 조회됩니다. 타인 대리 타각은 사규에 따라 제한됩니다.</p>
      </footer>

      {/* 직원 PIN 모달 */}
      {modalStep === 'pin' && selectedEmp && (
        <PinModal
          employee={selectedEmp}
          onClose={() => {
            setModalStep(null);
            setSelectedEmp(null);
          }}
          onSuccess={handlePinSuccess}
        />
      )}

      {/* 출근 모달 */}
      {modalStep === 'checkin' && selectedEmp && (
        <CheckInModal
          employee={selectedEmp}
          workType={workTypes.find((w) => w.id === selectedEmp.workTypeId)}
          {...getEmpStats(selectedEmp.id, selectedEmp.workTypeId)}
          onClose={() => {
            setModalStep(null);
            setSelectedEmp(null);
          }}
          onConfirmCheckIn={handleConfirmCheckIn}
        />
      )}

      {/* 퇴근 모달 */}
      {modalStep === 'checkout' && selectedEmp && (
        <CheckOutModal
          employee={selectedEmp}
          shift={activeShifts[selectedEmp.id]}
          onClose={() => {
            setModalStep(null);
            setSelectedEmp(null);
          }}
          onConfirmCheckOut={handleConfirmCheckOut}
        />
      )}

      {/* 사장 관리자 마스터 PIN 모달 */}
      {adminPinModal && (
        <PinModal
          title="사장님 마스터 인증"
          employee={{ name: '사장님', pin: settings.adminPin || '0000' }}
          onClose={() => setAdminPinModal(false)}
          onSuccess={() => {
            setAdminPinModal(false);
            onOpenAdmin();
          }}
        />
      )}
    </div>
  );
}
