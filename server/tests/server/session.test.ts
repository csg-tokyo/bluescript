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
    expect(exe.length).toBe(144);
  });

  test("Code2: use native functions", () => {
    const tsString = `
    console_log_integer(3);
    `
    const exe = session.execute(tsString);
    expect(exe.length).toBe(104);
  });

  test("Code3: use defined functions and variables", () => {
    const tsString = `
    while (i < 10) {
      i += 1;
    }
    console_log_integer(i);
    console_log_integer(func1(3));
    `
    const exe = session.execute(tsString);
    expect(exe.length).toBe(194);
  });

  test("Code4: redefine predefined function", () => {
    const tsString = `
    function func1(n: integer) {
      return n + 4;
    }
    `
    const exe = session.execute(tsString);
    expect(exe.length).toBe(120);
  });
});