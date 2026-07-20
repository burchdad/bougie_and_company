export function roundToNinetyNine(value: number) {
  if (value <= 0) {
    return 0;
  }

  const dollars = Math.floor(value);
  const rounded = dollars + 0.99;
  return Number((rounded < value ? dollars + 1.99 : rounded).toFixed(2));
}

