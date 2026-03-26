import type { ImageSourcePropType } from 'react-native';
import { sanitizeFotoUrl } from './format';

const DefaultAvatar = require('../assets/imagenes/avatar-default.jpg');

/** Resolve an avatar URL into an ImageSource, falling back to the default avatar. */
export const resolveAvatarSource = (value: unknown): ImageSourcePropType => {
  const clean = sanitizeFotoUrl(value);
  if (clean) {
    return { uri: clean };
  }
  return DefaultAvatar;
};

export { DefaultAvatar };
