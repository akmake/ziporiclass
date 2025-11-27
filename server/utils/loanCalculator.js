// server/utils/loanCalculator.js

/**
 * מחזיר את הריבית שהייתה בתוקף לתאריך מסוים.
 */
function getRateForDate(date, rateHistory) {
  const applicableRate = rateHistory
    .filter(r => r.date <= date)
    .pop();
  return applicableRate ? applicableRate.rate : (rateHistory[0]?.rate || 0);
}

/**
 * מחשב לוח סילוקין דינמי המבוסס על היסטוריית ריביות משתנה.
 */
export function calculateDynamicSchedule({ loan, rateHistory }) {
  const { principal, termInMonths, startDate, repaymentType, interestMargin } = loan;
  const schedule = [];
  let remainingBalance = principal;
  const principalPerMonth = repaymentType === 'קרן שווה' ? principal / termInMonths : 0;

  for (let i = 1; i <= termInMonths; i++) {
    const paymentDate = new Date(startDate);
    paymentDate.setMonth(paymentDate.getMonth() + i);

    const primeRate = getRateForDate(paymentDate, rateHistory);
    const annualRate = primeRate + interestMargin;
    const monthlyInterestRate = annualRate / 100 / 12;

    // הריבית על התשלום הנוכחי תמיד מחושבת על היתרה הקיימת
    const interestPayment = remainingBalance * monthlyInterestRate;
    let principalPayment, totalPayment;

    if (repaymentType === 'שפיצר') {
      // =======================   התיקון כאן   =======================
      // הוספנו בדיקה פשוטה: אם הריבית היא 0, החישוב פשוט ומונע חלוקה באפס.
      if (monthlyInterestRate === 0) {
        totalPayment = principal / termInMonths;
        principalPayment = totalPayment; // בריבית 0, כל התשלום הוא על חשבון הקרן
      } else {
        // אם הריבית אינה 0, נשתמש בנוסחה המורכבת המקורית
        const remainingTerm = termInMonths - i + 1;
        const monthlyPayment = remainingBalance * (monthlyInterestRate * Math.pow(1 + monthlyInterestRate, remainingTerm)) / (Math.pow(1 + monthlyInterestRate, remainingTerm) - 1);
        totalPayment = monthlyPayment;
        principalPayment = monthlyPayment - interestPayment;
      }
      // =====================   סוף התיקון   =====================

    } else { // קרן שווה
      principalPayment = principalPerMonth;
      totalPayment = principalPerMonth + interestPayment;
    }

    remainingBalance -= principalPayment;

    schedule.push({
      paymentNumber: i,
      date: paymentDate,
      principal: parseFloat(principalPayment.toFixed(2)),
      interest: parseFloat(interestPayment.toFixed(2)),
      totalPayment: parseFloat(totalPayment.toFixed(2)),
      remainingBalance: parseFloat(Math.max(0, remainingBalance).toFixed(2)),
      rate: annualRate,
    });
  }
  return schedule;
}