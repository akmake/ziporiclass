// server/utils/loanCalculator.js

/**
 * מחשב לוח סילוקין להלוואה בשיטת "שפיצר".
 * @returns {Array<object>} מערך אובייקטים המייצג את לוח הסילוקין.
 */
export function calculateSpitzerSchedule({ principal, annualRate, termInMonths, startDate }) {
  const schedule = [];
  let remainingBalance = principal;
  const monthlyInterestRate = annualRate / 100 / 12;

  // נוסחת שפיצר לחישוב ההחזר החודשי הקבוע
  const monthlyPayment = principal * (monthlyInterestRate * Math.pow(1 + monthlyInterestRate, termInMonths)) / (Math.pow(1 + monthlyInterestRate, termInMonths) - 1);

  for (let i = 1; i <= termInMonths; i++) {
    const interestPayment = remainingBalance * monthlyInterestRate;
    const principalPayment = monthlyPayment - interestPayment;
    remainingBalance -= principalPayment;

    const paymentDate = new Date(startDate);
    paymentDate.setMonth(paymentDate.getMonth() + i);

    schedule.push({
      paymentNumber: i,
      date: paymentDate,
      principal: parseFloat(principalPayment.toFixed(2)),
      interest: parseFloat(interestPayment.toFixed(2)),
      totalPayment: parseFloat(monthlyPayment.toFixed(2)),
      remainingBalance: parseFloat(Math.max(0, remainingBalance).toFixed(2)),
    });
  }
  return schedule;
}

/**
 * מחשב לוח סילוקין להלוואה בשיטת "קרן שווה".
 * @returns {Array<object>} מערך אובייקטים המייצג את לוח הסילוקין.
 */
export function calculateKerenShavaSchedule({ principal, annualRate, termInMonths, startDate }) {
  const schedule = [];
  let remainingBalance = principal;
  const monthlyInterestRate = annualRate / 100 / 12;
  const principalPerMonth = principal / termInMonths;

  for (let i = 1; i <= termInMonths; i++) {
    const interestPayment = remainingBalance * monthlyInterestRate;
    const totalPayment = principalPerMonth + interestPayment;
    remainingBalance -= principalPerMonth;

    const paymentDate = new Date(startDate);
    paymentDate.setMonth(paymentDate.getMonth() + i);

    schedule.push({
      paymentNumber: i,
      date: paymentDate,
      principal: parseFloat(principalPerMonth.toFixed(2)),
      interest: parseFloat(interestPayment.toFixed(2)),
      totalPayment: parseFloat(totalPayment.toFixed(2)),
      remainingBalance: parseFloat(Math.max(0, remainingBalance).toFixed(2)),
    });
  }
  return schedule;
}