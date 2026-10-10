/**
 * [카페 출퇴근 & 급여 관리 시스템 - Google Apps Script 연동 코드]
 * 
 * 구글 스프레드시트 상단 메뉴 [확장 프로그램] -> [Apps Script] 에 
 * 아래 코드를 전체 복사하여 붙여넣고 [배포]하시면 됩니다.
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  // 동시 요청 충돌 방지를 위해 최대 10초 대기
  lock.tryLock(10000);

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("출퇴근기록");

    // 1. '출퇴근기록' 탭이 없으면 자동으로 생성하고 첫 줄 헤더를 넣습니다.
    if (!sheet) {
      sheet = ss.insertSheet("출퇴근기록");
      sheet.appendRow([
        "기록ID",
        "근무일자",
        "직원이름",
        "근무형태",
        "출근시각",
        "퇴근시각",
        "휴게시간(분)",
        "실근무시간(시간)",
        "시급(원)",
        "일급(원)",
        "근무구분",
        "승인여부",
        "비고/수정이력",
        "동기화일시"
      ]);
      // 헤더 스타일 서식 지정
      sheet.getRange(1, 1, 1, 14).setBackground("#F3F4F6").setFontWeight("bold");
    }

    // 2. 웹(Vercel/로컬)에서 넘어온 출퇴근 데이터 파싱
    var requestData = JSON.parse(e.postData.contents);
    var record = requestData.data;

    // 3. 스프레드시트에 새 행 추가
    sheet.appendRow([
      record.id || "",
      record.date || "",
      record.empName || "",
      record.workType || "",
      record.checkInTime || "",
      record.checkOutTime || "",
      record.breakMinutes || 0,
      record.actualWorkHours || 0,
      record.hourlyWage || 0,
      record.dailyPay || 0,
      record.workCategory || "정상출근",
      record.isApproved ? "승인완료" : "확인대기",
      record.note || "",
      Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm:ss")
    ]);

    // 성공 응답 반환
    return ContentService.createTextOutput(JSON.stringify({ result: "success" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ result: "error", error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// 웹 브라우저에서 웹앱 URL로 직접 접속했을 때 정상 작동 테스트용
function doGet(e) {
  return ContentService.createTextOutput("🎉 카페 출퇴근 연동 구글 웹 앱이 정상 작동 중입니다.");
}
