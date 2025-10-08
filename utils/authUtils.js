import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

export async function hashPassword(password, rounds = 12) {
  return await bcrypt.hash(password, rounds);
}

export async function comparePassword(plainPassword, hashedPassword) {
  return await bcrypt.compare(plainPassword, hashedPassword);
}

export function generateToken(payload, expiresIn = '3h') {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
}

export function sanitizeUserData(user, fieldsToRemove = ['password']) {
  const sanitized = { ...user };
  fieldsToRemove.forEach(field => delete sanitized[field]);
  return sanitized;
}
