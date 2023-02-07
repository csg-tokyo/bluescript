import * as Datastore from 'nedb';
import {RemoveOptions, UpdateOptions} from "nedb";


export default class BaseTable {
  private db: Datastore;

  constructor(filePath: string) {
    this.db = new Datastore({
      filename: filePath,
      autoload: true,
    });
  }

  public insert(data: object): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.insert(data, (err, result) => {
        if (err) return reject(err);
        resolve()
      });
    });
  }

  public update(query: any, update: any, options: UpdateOptions): Promise<number> {
    return new Promise((resolve, reject) => {
      this.db.update(query, update, options, (err, numberOfUpdated) => {
        if(err) return reject(err);
        resolve(numberOfUpdated);
      })
    })
  }

  public find(query: object): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.find(query, (err: Error|null, documents: any[]) => {
        if (err) return reject(err);
        resolve(documents);
      })
    })
  }

  public remove(query: any, options: RemoveOptions): Promise<number> {
    return new Promise((resolve, reject) => {
      this.db.remove(query, options, (err, numRemoved) => {
        if (err) return reject(err);
        resolve(numRemoved);
      })
    })
  }
}