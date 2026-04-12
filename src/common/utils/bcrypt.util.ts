import { hash, compare } from 'bcryptjs'

export const hashPassword = async (password: string): Promise<string> => {
  const hashedPassword = await hash(password, 10)
  return hashedPassword
}

// bcryptjs đọc salt trong hashedPasswordFromDB để hash passwordFromFE rồi so sánh
// nên ko cần lo về salt của 2 thằng này giống nhau không
export const comparePassword = async (
  passwordFromFE: string,
  hashedPasswordFromDB: string,
): Promise<boolean> => {
  const result = await compare(passwordFromFE, hashedPasswordFromDB)
  return result
}

// số 10 ở đây là độ mạnh, số vòng tính toán chứ ko phải salt
// bcrypt luôn tạo salt mới mỗi lần hash
export const hashOTP = async (otp: string): Promise<string> => {
  const hashedOTP = await hash(otp, 10)
  return hashedOTP
}

export const compareOTP = async (OtpFromFE: string, hashedOtpFromDB: string): Promise<boolean> => {
  const result = await compare(OtpFromFE, hashedOtpFromDB)
  return result
}

export const hashRefreshToken = async (refreshToken: string): Promise<string> => {
  const hashedRefreshToken = await hash(refreshToken, 10)
  return hashedRefreshToken
}

export const compareRefreshToken = async (
  refreshTokenFromFE: string,
  hashedrefreshTokenFromDB: string,
): Promise<boolean> => {
  const result = await compare(refreshTokenFromFE, hashedrefreshTokenFromDB)
  return result
}
