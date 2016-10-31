declare module "farmhash" {
  type input = string | Buffer;

  interface Farmhash {
    hash32(data: input): number;
    hash32WithSeed(data: input, seed: number): number;
    hash64(data: input): string;
    hash64WithSeed(data: input, seed: number): string;
    hash64WithSeeds(data: input, seed1: number, seed2: number): string;
    hash32v1(data: input): number;
    fingerprint32(data: input): number;
    fingerprint64(data: input): string;
  }

  let farmhash: Farmhash;
  export = farmhash;
}