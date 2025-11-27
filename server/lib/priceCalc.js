function calculateSinglePrice({ adults, teens, children, babies }, priceList) {
  const totalGuests = adults + teens + children + babies;
  if (totalGuests === 1) return priceList.single_room || 0;

  let total = priceList.couple || 0;
  const extraAdults = Math.max(0, adults - 2);
  total += extraAdults * (priceList.teen || 0);
  total += (teens || 0) * (priceList.teen || 0);
  total += (children || 0) * (priceList.child || 0);
  total += (babies || 0) * (priceList.baby || 0);
  return total;
}

function calculateMultiPrice(room, priceListsByName, selectedNames) {
  return selectedNames.reduce((sum, name) => {
    const pl = priceListsByName[name];
    return sum + (pl ? calculateSinglePrice(room, pl) : 0);
  }, 0);
}

module.exports = { calculateSinglePrice, calculateMultiPrice };