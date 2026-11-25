"use strict";
// Local replacement for buffer-equal-constant-time@1.0.1 (pulled in by
// netlify-cli -> jsonwebtoken -> jws -> jwa). The original touches
// `SlowBuffer.prototype` at load time; SlowBuffer was removed in Node 25, so
// the CLI crashes on startup with "Cannot read properties of undefined
// (reading 'prototype')". This keeps the same API, backed by Node's built-in
// constant-time compare.
var crypto = require("crypto");
var Buffer = require("buffer").Buffer;

function bufferEq(a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) return false;
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// The original could monkey-patch Buffer.prototype.equal; nothing in this
// project relies on that, so these are kept as harmless no-ops.
bufferEq.install = function () {};
bufferEq.restore = function () {};

module.exports = bufferEq;
