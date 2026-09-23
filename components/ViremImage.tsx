/**
 * ViremImage — thin wrapper around Image with fallback handling.
 */
import React from 'react';
import { Image, type ImageProps } from 'react-native';

const DefaultAvatar = require('../assets/imagenes/avatar-default.jpg');

type Props = ImageProps & {
  fallback?: any;
};

const ViremImage: React.FC<Props> = ({ fallback, source, ...rest }) => {
  const resolvedSource = source || fallback || DefaultAvatar;
  return <Image source={resolvedSource} {...rest} />;
};

export default ViremImage;
