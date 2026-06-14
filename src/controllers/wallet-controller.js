/* controllers/wallet-controller.js — Pure wallet business calculations.
   Extracted from TransactionModal.jsx.
   Exposed as window.calcCCInstallment. */

function calcCCInstallment(amount, months, annualRate) {
  const a = +amount, m = +months, r = +annualRate;
  if (!a || a <= 0 || !m || m <= 0) return null;
  const totalInterest  = a * (r / 100) * (m / 12);
  const monthlyPayment = (a + totalInterest) / m;
  return { monthlyPayment, totalInterest, totalPayable: a + totalInterest };
}
