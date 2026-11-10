export type SharedProgram = {
  code: string;
  inputs: string;
  maximumSteps: number | string;
};

export function readSharedProgram(
  hash: string,
  defaults: SharedProgram,
): SharedProgram {
  const parameters = new URLSearchParams(hash.replace(/^#/, ""));
  const limit = parameters.get("maxSteps");
  const numericLimit = limit?.trim() ? Number(limit) : NaN;
  return {
    code: parameters.get("code") ?? defaults.code,
    inputs: parameters.get("inputs") ?? defaults.inputs,
    maximumSteps:
      limit === null
        ? defaults.maximumSteps
        : Number.isSafeInteger(numericLimit) && numericLimit > 0
          ? numericLimit
          : limit,
  };
}

export function sharedProgramHash(program: SharedProgram): string {
  return (
    "#" +
    new URLSearchParams({
      code: program.code,
      inputs: program.inputs,
      maxSteps: String(program.maximumSteps),
    }).toString()
  );
}
