import jwt from 'jsonwebtoken';

const signAccessToken = (payload) =>
  jwt.sign(payload, process.env.JWT_ACCESS_SECRET, { expiresIn: '15m' });

const signRefreshToken = (payload) =>
  jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });

export const createAndSendTokens = (user, res) => {
  const accessToken = signAccessToken({ id: user._id, role: user.role });
  const refreshToken = signRefreshToken({ id: user._id, v: user.tokenVersion });

  // ⬇️ === תיקון: הגדרה זו חייבת להיות true עבור SameSite=None === ⬇️
  const secure = true; 

  res
    .cookie('jwt', accessToken, {
      httpOnly: true,
      // ⬇️ === תיקון: SameSite=None נדרש לבקשות cross-domain === ⬇️
      sameSite: 'None', 
      secure, // יקבל 'true'
      maxAge: 15 * 60 * 1000,
    })
    .cookie('refreshToken', refreshToken, {
      httpOnly: true,
      // ⬇️ === תיקון: SameSite=None נדרש לבקשות cross-domain === ⬇️
      sameSite: 'None', 
      secure, // יקבל 'true'
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
};