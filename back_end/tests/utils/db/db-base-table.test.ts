import BaseTable from "../../../src/utils/db/base-table";

test("playground", async () => {
  const table = new BaseTable("./data/db-test/playground.db");
  const foo = new Foo();
  const obj = {
    "name": "foo",
    "obj": foo
  }
  await table.insert(obj);
  const result = await table.find({"name": "foo"});
  console.log(((result[0] as any).obj as Bar))
});

interface Bar {
  func1(n: number):string
}

class Foo implements Bar{
  hey: string = "foo"
  public func1(n:number):string {
    return this.hey;
  }
}