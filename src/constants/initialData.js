export const INITIAL_SETTINGS = {
  storeName: "카페 모닝브루",
  adminPin: "0000",
  minWage: 10030, // 2025-2026년 기준 기본값
  isUnderFiveEmployees: true, // 5인 미만 사업장 기본
  allowAnnualLeave: false, // 연차 자율 부여 여부
  weekStartDay: "mon", // 한 주의 시작 요일
  googleScriptUrl: "",
  googleSheetDocUrl: "", // 구글 스프레드시트 바로가기 웹 링크
};

export const INITIAL_WORK_TYPES = [
  {
    id: "WT-01",
    name: "주 15시간 미만",
    weeklyTargetHours: 14,
    weeklyMaxHours: 14.98,
    monthlyTargetHours: 59,
    dailyMaxHours: 8,
    description: "주 15시간 미만 근무 (주휴수당, 퇴직금 제외 대상)",
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-300",
  },
  {
    id: "WT-02",
    name: "주 25시간",
    weeklyTargetHours: 25,
    weeklyMaxHours: 40,
    monthlyTargetHours: 60,
    dailyMaxHours: 8,
    description: "주 15시간 이상 ~ 40시간 미만 (주휴수당 및 4대보험 가입 대상)",
    badgeColor: "bg-blue-100 text-blue-800 border-blue-300",
  },
  {
    id: "WT-03",
    name: "주 40시간",
    weeklyTargetHours: 40,
    weeklyMaxHours: 52,
    monthlyTargetHours: 209,
    dailyMaxHours: 8,
    description: "주 40시간 풀타임 근로자 (최대 52시간 한도)",
    badgeColor: "bg-purple-100 text-purple-800 border-purple-300",
  },
  {
    id: "WT-04",
    name: "주 16시간 (주말)",
    weeklyTargetHours: 16,
    weeklyMaxHours: 20,
    monthlyTargetHours: 64,
    dailyMaxHours: 8,
    description: "토/일 주말 집중 근무자",
    badgeColor: "bg-amber-100 text-amber-800 border-amber-300",
  },
];

export const INITIAL_EMPLOYEES = [
  {
    id: "EMP-001",
    name: "김민지",
    pin: "1234",
    workTypeId: "WT-01", // 초단시간 파트너
    hourlyWage: 10030,
    hireDate: "2026-03-01",
    birthDate: "2002-05-15",
    contractWeeklyHours: 14,
    contractDailyHours: 4.5,
    scheduledDays: "월,수,금",
    scheduledStartTime: "13:00",
    scheduledEndTime: "17:30",
    isActive: true,
  },
  {
    id: "EMP-002",
    name: "박지훈",
    pin: "2345",
    workTypeId: "WT-02", // 파트타이머
    hourlyWage: 10500,
    hireDate: "2025-11-15",
    birthDate: "2000-08-20",
    contractWeeklyHours: 25,
    contractDailyHours: 5,
    scheduledDays: "월,화,수,목,금",
    scheduledStartTime: "09:00",
    scheduledEndTime: "14:30",
    isActive: true,
  },
  {
    id: "EMP-003",
    name: "최영호",
    pin: "3456",
    workTypeId: "WT-03", // 풀타임
    hourlyWage: 11000,
    hireDate: "2025-05-01",
    birthDate: "1996-01-10",
    contractWeeklyHours: 40,
    contractDailyHours: 8,
    scheduledDays: "화,수,목,금,토",
    scheduledStartTime: "10:00",
    scheduledEndTime: "19:00",
    isActive: true,
  },
  {
    id: "EMP-004",
    name: "이소희",
    pin: "4567",
    workTypeId: "WT-01", // 초단시간 / 청소년 (야간근로 알림 테스트)
    hourlyWage: 10030,
    hireDate: "2026-08-01",
    birthDate: "2009-02-10", // 18세 미만
    contractWeeklyHours: 10,
    contractDailyHours: 3.5,
    scheduledDays: "토,일",
    scheduledStartTime: "18:00",
    scheduledEndTime: "22:00",
    isActive: true,
  },
];

// 법령 정보 모음 (PRD 5장 & 3.6장 매핑)
export const LABOR_LAWS = [
  {
    id: "LAW-01",
    title: "근로기준법 제11조",
    summary: "적용 범위 (상시 5인 미만 사업장 특례)",
    detail: "상시 4명 이하의 근로자를 사용하는 사업 또는 사업장에는 대통령령으로 정하는 바에 따라 법의 일부 조항만을 적용합니다. (연장·야간 가산수당, 연차휴가 미적용 등)",
    url: "https://www.law.go.kr/법령/근로기준법",
  },
  {
    id: "LAW-02",
    title: "근로기준법 제17조",
    summary: "근로조건의 명시 및 서면 교부",
    detail: "임금, 소정근로시간, 휴일, 연차유급휴가 등의 근로조건을 명시하고 근로자에게 근로계약서 서면을 반드시 교부하여야 합니다.",
    url: "https://www.law.go.kr/법령/근로기준법",
  },
  {
    id: "LAW-03",
    title: "근로기준법 제18조 및 시행령 [별표 2]",
    summary: "단시간근로자 및 15시간 미만 초단시간 근로자",
    detail: "4주 동안을 평균하여 1주 동안의 소정근로시간이 15시간 미만인 근로자에 대하여는 제55조(주휴일) 및 제60조(연차유급휴가)를 적용하지 않습니다.",
    url: "https://www.law.go.kr/법령/근로기준법",
  },
  {
    id: "LAW-04",
    title: "근로기준법 제54조",
    summary: "휴게시간 부여 의무",
    detail: "근로시간이 4시간인 경우에는 30분 이상, 8시간인 경우에는 1시간 이상의 휴게시간을 근로시간 도중에 주어야 합니다.",
    url: "https://www.law.go.kr/법령/근로기준법",
  },
  {
    id: "LAW-05",
    title: "근로기준법 제55조 및 시행령 제30조",
    summary: "주휴일 및 주휴수당",
    detail: "1주일 동안의 소정근로일을 개근한 자에게는 1주일에 평균 1회 이상의 유급휴일(주휴수당)을 보장하여야 합니다.",
    url: "https://www.law.go.kr/법령/근로기준법",
  },
  {
    id: "LAW-06",
    title: "근로기준법 제56조",
    summary: "연장·야간 및 휴일 근로 가산수당",
    detail: "상시 5인 이상 사업장은 연장근로, 야간근로(22시~06시), 휴일근로에 대하여 통상임금의 100분의 50 이상을 가산하여 지급하여야 합니다.",
    url: "https://www.law.go.kr/법령/근로기준법",
  },
  {
    id: "LAW-07",
    title: "최저임금법 제6조",
    summary: "최저임금의 효력 및 지급 의무",
    detail: "사용자는 최저임금의 적용을 받는 근로자에게 최저임금액 이상의 임금을 지급하여야 합니다. 위반 시 형사처벌 대상입니다.",
    url: "https://www.law.go.kr/법령/최저임금법",
  },
  {
    id: "LAW-08",
    title: "근로기준법 제70조",
    summary: "18세 미만 청소년의 야간·휴일근로 제한",
    detail: "18세 미만자를 오후 10시부터 오전 6시까지의 시간 및 휴일에 근로시키지 못합니다. (단, 본인 동의 및 고용노동부장관 인가 시 예외)",
    url: "https://www.law.go.kr/법령/근로기준법",
  },
  {
    id: "LAW-09",
    title: "근로자퇴직급여 보장법 제4조",
    summary: "퇴직급여 제도의 설정 (1년 이상 계속근로)",
    detail: "계속근로기간 1년에 대하여 30일분 이상의 평균임금을 퇴직금으로 지급하여야 합니다. (4주간 평균 주 15시간 미만 근로자 제외)",
    url: "https://www.law.go.kr/법령/근로자퇴직급여보장법",
  },
];
