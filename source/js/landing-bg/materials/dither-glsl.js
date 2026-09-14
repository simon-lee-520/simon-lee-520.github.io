/** three.js ShaderChunk dithering_pars_fragment + dithering（与 r112 一致） */
export const DITHER_GLSL = `
vec3 dithering( vec3 color ) {
  float grid_position = rand( gl_FragCoord.xy );
  vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
  dither_shift_RGB = mix( 2.0 * dither_shift_RGB, 2.0 * dither_shift_RGB - 1.0, grid_position );
  return color + dither_shift_RGB;
}
float rand( const in vec2 uv ) {
  const float a = 12.9898, b = 78.233, c = 43758.5453;
  float dt = dot( uv.xy, vec2( a, b ) ), sn = mod( dt, 3.141592653589793 );
  return fract( sin( sn ) * c );
}
`
