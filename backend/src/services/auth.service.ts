import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AuditLog, RefreshToken, User } from '../models/index.js';
import { AppError, randomToken, sha256 } from '../utils/index.js';

const signAccess = (user: any) => jwt.sign({ id: user.id, role: user.role, companyId: user.companyId?.toString() }, env.JWT_ACCESS_SECRET, { expiresIn: env.ACCESS_TOKEN_TTL as jwt.SignOptions['expiresIn'] });
const issueTokens = async (user: any) => {
  const raw = randomToken();
  await RefreshToken.create({ userId: user._id, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86400000) });
  return { accessToken: signAccess(user), refreshToken: raw, expiresIn: env.ACCESS_TOKEN_TTL };
};
export const authService = {
  async register(input: { name: string; email: string; password: string; department?: string }) {
    if (await User.exists({ email: input.email.toLowerCase() })) throw new AppError(409, 'Email already registered', 'EMAIL_EXISTS');
    const isFirst = (await User.estimatedDocumentCount()) === 0;
    const user = await User.create({ ...input, email: input.email.toLowerCase(), passwordHash: await bcrypt.hash(input.password, 12), role: isFirst ? 'super_admin' : 'employee' });
    await AuditLog.create({ actor: user._id, action: 'auth.register', resource: 'user', resourceId: user.id });
    return { user, tokens: await issueTokens(user) };
  },
  async login(email: string, password: string, ip?: string) {
    const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
    if (!user || !user.isActive || !(await bcrypt.compare(password, user.get('passwordHash')))) { await AuditLog.create({ action: 'auth.login_failed', resource: 'user', ip, metadata: { email } }); throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS'); }
    user.lastLoginAt = new Date(); await user.save();
    await AuditLog.create({ actor: user._id, action: 'auth.login', resource: 'user', resourceId: user.id, ip });
    return { user, tokens: await issueTokens(user) };
  },
  async refresh(raw: string) {
    const stored = await RefreshToken.findOne({ tokenHash: sha256(raw), revokedAt: null }).populate('userId');
    if (!stored || stored.expiresAt < new Date()) throw new AppError(401, 'Invalid refresh token', 'INVALID_REFRESH_TOKEN');
    stored.revokedAt = new Date(); await stored.save();
    return issueTokens(stored.userId);
  },
  async logout(raw: string) { await RefreshToken.updateOne({ tokenHash: sha256(raw) }, { revokedAt: new Date() }); },
};
