import Session from "../../src/server/session";

let session: Session;

describe('Test session', () => {
  beforeAll(() => {
    session = new Session();
  });

  test("Code1: function and variable declaration", () => {
    const tsString = `
    let i = 3;
    function func1(n: integer) {
      return n + 1;
    }
    `
    const exe = session.execute(tsString);
    expect(exe.length).toBe(198);
  });

  test("Code2: use native functions", () => {
    const tsString = `
    console_log_number(3);
    `
    const exe = session.execute(tsString);
    expect(exe.length).toBe(126);
  });

  test("Code3: use defined functions and variables", () => {
    const tsString = `
    while (i < 10) {
      i += 1;
    }
    console_log_number(i);
    console_log_number(func1(3));
    `
    const exe = session.execute(tsString);
    expect(exe.length).toBe(198);
  });

  test("Code4: update predefined function", () => {
    const tsString = `
    function func1(n: integer) {
      return n + 4;
    }
    `
    const exe = session.execute(tsString);
    expect(exe.length).toBe(182);
  });
});