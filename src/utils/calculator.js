// 시간(HH:mm)을 분(minutes)으로 변환
export function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

// 분(minutes)을 HH:mm 문자열로 변환
export function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.floor(minutes % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// 분(minutes)을 "X시간 Y분" 문자열로 변환
export function formatMinutesToHours(minutes) {
  if (minutes < 0) minutes = 0;
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  if (h === 0) return `${m}분`;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}

// 법정 권고 기본 휴게시간 계산 (근로기준법 제54조)
export function getRecommendedBreakMinutes(stayMinutes) {
  if (stayMinutes >= 480) { // 8시간 이상
    return 60;
  }
  if (stayMinutes >= 240) { // 4시간 이상
    return 30;
  }
  return 0;
}

// 10원 미만 절사 (원 단위 버림)
export function truncateTenWon(amount) {
  return Math.floor(amount / 10) * 10;
}

// 야간 근무시간(22:00 ~ 06:00) 계산 (분 단위)
export function calculateNightMinutes(startTime, endTime) {
  let start = timeToMinutes(startTime);
  let end = timeToMinutes(endTime);
  if (end <= start) end += 24 * 60; // 자정 넘김 처리

  let nightMinutes = 0;
  // 야간 구간: 22:00(1320분) ~ 익일 06:00(1800분 또는 360분)
  for (let m = start; m < end; m++) {
    const modMin = m % (24 * 60);
    if (modMin >= 22 * 60 || modMin < 6 * 60) {
      nightMinutes++;
    }
  }
  return nightMinutes;
}

// 일급 및 실근무시간 정밀 계산
export function calculateDailyRecord({
  checkInTime,
  checkOutTime,
  breakMinutes = 0,
  hourlyWage = 10030,
  isUnderFive = true,
}) {
  const startMin = timeToMinutes(checkInTime);
  let endMin = timeToMinutes(checkOutTime);
  if (endMin < startMin) endMin += 24 * 60; // 익일 퇴근

  const totalStayMin = endMin - startMin;
  const actualWorkMin = Math.max(0, totalStayMin - breakMinutes);
  const actualWorkHours = Number((actualWorkMin / 60).toFixed(2));

  // 기본 시급 분단위 계산
  const basePayPerMin = hourlyWage / 60;
  let basePay = actualWorkMin * basePayPerMin;
  let overtimePay = 0;
  let nightPay = 0;

  // 5인 이상 사업장일 때 가산수당 계산 (근로기준법 제56조)
  if (!isUnderFive) {
    // 1일 8시간(480분) 초과 연장수당 (0.5배 가산)
    if (actualWorkMin > 480) {
      const overtimeMin = actualWorkMin - 480;
      overtimePay = overtimeMin * basePayPerMin * 0.5;
    }
    // 야간 근로시간 가산수당 (0.5배 가산)
    const nightMin = calculateNightMinutes(checkInTime, checkOutTime);
    nightPay = nightMin * basePayPerMin * 0.5;
  }

  const totalPay = truncateTenWon(basePay + overtimePay + nightPay);

  return {
    actualWorkMinutes: actualWorkMin,
    actualWorkHours,
    breakMinutes,
    basePay: truncateTenWon(basePay),
    overtimePay: truncateTenWon(overtimePay),
    nightPay: truncateTenWon(nightPay),
    dailyPay: totalPay,
  };
}

// 주휴시간 및 주휴수당 계산 (통상 단시간근로자 비례식)
export function calculateWeeklyHolidayPay(weeklyTotalHours, hourlyWage) {
  if (weeklyTotalHours < 15) {
    return { holidayHours: 0, holidayPay: 0 };
  }
  // (1주 총 근로시간 / 40) * 8 (최대 8시간 한도)
  const holidayHours = Number((Math.min(weeklyTotalHours / 40, 1) * 8).toFixed(2));
  const holidayPay = truncateTenWon(holidayHours * hourlyWage);
  return { holidayHours, holidayPay };
}

// 만 나이 계산
export function getAge(birthDateStr) {
  if (!birthDateStr) return 30;
  const today = new Date();
  const birthDate = new Date(birthDateStr);
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

// 근속 개월 수 계산
export function getTenureMonths(hireDateStr) {
  if (!hireDateStr) return 0;
  const today = new Date();
  const hireDate = new Date(hireDateStr);
  return (today.getFullYear() - hireDate.getFullYear()) * 12 + (today.getMonth() - hireDate.getMonth());
}
