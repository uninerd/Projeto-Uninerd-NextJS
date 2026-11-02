export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
};

export const isValidCPF = (cpf: string): boolean => {
  const cpfClean = cpf.replace(/\.|-/g, "");
  if (cpfClean.length !== 11 || /^(\d)\1{10}$/.test(cpfClean)) return false;

  const digits = cpfClean.split("").map(Number);
  const calculateDigit = (slice: number[]): number => {
    const sum = slice.reduce((acc, digit, index) => acc + digit * (slice.length + 1 - index), 0);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  const d1 = calculateDigit(digits.slice(0, 9));
  if (d1 !== digits[9]) return false;

  const d2 = calculateDigit(digits.slice(0, 10));
  return d2 === digits[10];
};

export function isStrongPassword(password: string): boolean {
  // Mínimo de 8 caracteres, pelo menos uma letra maiúscula, uma minúscula, um número e um caractere especial
  const strongRegex = new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])(?=.{8,})");
  return strongRegex.test(password);
}


export const maskCPF = (value: string) => {
  return value.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
};
