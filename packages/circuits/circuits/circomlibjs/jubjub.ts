// import { getCurveFromName, Scalar } from "ffjavascript";
const Scalar = require("ffjavascript").Scalar;
const getCurveFromName = require("ffjavascript").getCurveFromName;

export async function buildJubJub() {
  const bls12381 = await getCurveFromName("BLS12381", true);
  return new JubJub(bls12381.Fr);
}

class JubJub {
  F: {
    mul(arg0: any, arg1: any): unknown;
    sub(arg0: any, arg1: any): any;
    add(arg0: any, arg1: any): any;
    div(arg0: any, arg1: any): any;
    one(one: any, dtau: any): any;
    isZero(arg0: any): unknown;
    eq(arg0: any, one: any): unknown;
    square(arg0: any): unknown;
    toRprLE(buff: Uint8Array, arg1: number, arg2: any): unknown;
    toObject(arg0: any): unknown;
    fromRprLE(buff: number[], arg1: number): any;
    exp(x2: any, half: any): unknown;
    half(x2: any, half: any): unknown;
    sqrt(x2: any): unknown;
    neg(x: any): any;
    e: (arg0: string) => any;
  };
  p: any;
  pm1d2: any;
  Generator: any[];
  Base8: any[];
  order: any;
  subOrder: any;
  A: any;
  D: any;
  constructor(F: { e: (arg0: string) => any }) {
    this.F = F as any;
    this.p = Scalar.fromString(
      "52435875175126190479447740508185965837690552500527637822603658699938581184513",
    );
    this.pm1d2 = Scalar.div(Scalar.sub(this.p, Scalar.e(1)), Scalar.e(2));

    this.Generator = [
      F.e("50210964013865202807697778192253911217867412634541528443086291916476367487291"),
      F.e("9533795486386580087172316456033811970489191363732297785927937945443378397185"),
    ];
    this.Base8 = [
      F.e("25048732578063176751608348748134148938511950496662102134944680124345451629928"),
      F.e("37193546711722353718211339597021920218737743307281823076963067517006020382455"),
    ];
    this.order = Scalar.fromString(
      "52435875175126190479447740508185965837647370126978538250922873299137466033592",
    );
    this.subOrder = Scalar.shiftRight(this.order, 3);
    this.A = F.e("40964");
    this.D = F.e("40960");
  }

  addPoint(a: any[], b: any[]) {
    const F = this.F;

    const res = [];

    /* does the equivalent of:
        res[0] = bigInt((a[0]*b[1] + b[0]*a[1]) *  bigInt(bigInt("1") + d*a[0]*b[0]*a[1]*b[1]).inverse(q)).affine(q);
        res[1] = bigInt((a[1]*b[1] - cta*a[0]*b[0]) * bigInt(bigInt("1") - d*a[0]*b[0]*a[1]*b[1]).inverse(q)).affine(q);
        */

    const beta = F.mul(a[0], b[1]);
    const gamma = F.mul(a[1], b[0]);
    const delta = F.mul(F.sub(a[1], F.mul(this.A, a[0])), F.add(b[0], b[1]));
    const tau = F.mul(beta, gamma);
    const dtau = F.mul(this.D, tau);

    res[0] = F.div(F.add(beta, gamma), F.add(F.one, dtau));

    res[1] = F.div(F.add(delta, F.sub(F.mul(this.A, beta), gamma)), F.sub(F.one, dtau));

    return res;
  }

  mulPointEscalar(base: any, e: any) {
    const F = this.F;
    let res = [F.e("0"), F.e("1")];
    let rem = e;
    let exp = base;

    while (!Scalar.isZero(rem)) {
      if (Scalar.isOdd(rem)) {
        res = this.addPoint(res, exp);
      }
      exp = this.addPoint(exp, exp);
      rem = Scalar.shiftRight(rem, 1);
    }

    return res;
  }

  inSubgroup(P: any) {
    const F = this.F;
    if (!this.inCurve(P)) return false;
    const res = this.mulPointEscalar(P, this.subOrder);
    return F.isZero(res[0]) && F.eq(res[1], F.one);
  }

  inCurve(P: any[]) {
    const F = this.F;
    const x2 = F.square(P[0]);
    const y2 = F.square(P[1]);

    if (!F.eq(F.add(F.mul(this.A, x2), y2), F.add(F.one, F.mul(F.mul(x2, y2), this.D))))
      return false;

    return true;
  }

  packPoint(P: any[]) {
    const F = this.F;
    const buff = new Uint8Array(32);
    F.toRprLE(buff, 0, P[1]);
    const n = F.toObject(P[0]);
    if (Scalar.gt(n, this.pm1d2)) {
      buff[31] = buff[31] | 0x80;
    }
    return buff;
  }

  unpackPoint(buff: number[]) {
    const F = this.F;
    let sign = false;
    const P = new Array(2);
    if (buff[31] & 0x80) {
      sign = true;
      buff[31] = buff[31] & 0x7f;
    }
    P[1] = F.fromRprLE(buff, 0);
    if (Scalar.gt(F.toObject(P[1]), this.p)) return null;

    const y2 = F.square(P[1]);

    const x2 = F.div(F.sub(F.one, y2), F.sub(this.A, F.mul(this.D, y2)));

    const x2h = F.exp(x2, F.half);
    if (!F.eq(F.one, x2h)) return null;

    let x = F.sqrt(x2);

    if (x == null) return null;

    if (sign) x = F.neg(x);

    P[0] = x;

    return P;
  }
}
