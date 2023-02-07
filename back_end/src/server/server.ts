import * as http from "http";
import {Buffer} from "node:buffer";
import ReplCompileHandler from "./path-handlers/repl-compile-handler";
import TsOnetimeCompileHandler from "./path-handlers/ts-onetime-compile-handler";
import ReplClearHandler from "./path-handlers/repl-clear-handler";
import COnetimeCompileHandler from "./path-handlers/c-onetime-compile-handler";

export default class HttpServer {
  readonly PORT = 8080;
  server: http.Server;

  constructor() {
    this.server = http.createServer();
    this.defineServer();
  }

  public listen() {
    this.server.listen(this.PORT);
    console.log(`Access to http://localhost:${this.PORT}`);
  }

  private defineServer() {
    let responseBody: string;
    let statusCode: number;
    const headers = {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Access-Control-Allow-Origin"
    }

    this.server.on("request", async (request, response) => {
      try {
        [responseBody, statusCode] = await this.pathHandler(request);
      } catch (e: any) {
        responseBody = JSON.stringify({errorMessage: e.message});
        statusCode = 500;
      }
      response.writeHead(statusCode, headers);
      response.write(JSON.stringify(responseBody));
      response.end();
    })
  }

  private async pathHandler(request: http.IncomingMessage): Promise<[string, number]> {
    let responseBody: object;
    let statusCode: number;

    if (request.method === "OPTIONS") { // for preflight
      return ["", 200];
    }
    let requestBody:string;

    switch (request.url) {
      case "/repl-compile":
        try {
          requestBody = await this.getRequestBody(request);
          const compileHandler = new ReplCompileHandler(JSON.parse(requestBody));
          responseBody = await compileHandler.handle();
          statusCode = 200;
        } catch (e) {
          console.log(e);
          responseBody = {message: e};
          statusCode = 500;
        }
        break;
      case "/repl-clear":
        const clearHandler = new ReplClearHandler();
        responseBody = await clearHandler.handle();
        statusCode = 200;
        break;
      case "/ts-onetime-compile":
        try {
          requestBody = await this.getRequestBody(request);
          const tsOnceCompileHandler = new TsOnetimeCompileHandler(JSON.parse(requestBody));
          responseBody = await tsOnceCompileHandler.handle();
          statusCode = 200;
        } catch (e) {
          console.log(e);
          responseBody = {message: e};
          statusCode = 500;
        }
        break;
      case "/c-onetime-compile":
        try {
          requestBody = await this.getRequestBody(request);
          const cOnceCompileHandler = new COnetimeCompileHandler(JSON.parse(requestBody));
          responseBody = await cOnceCompileHandler.handle();
          statusCode = 200;
        } catch (e) {
          console.log(e);
          responseBody = {message: e};
          statusCode = 500;
        }
        break;
      default:
        responseBody = {message: "Page not found."};
        statusCode = 404;
        break;
    }
    return [JSON.stringify(responseBody), statusCode];
  }

  private getRequestBody(request: http.IncomingMessage): Promise<string> {
    return new Promise((resolve) => {
      const body: any[] = [];
      request.on('data', (chunk) => {
        body?.push(chunk);
      }).on('end', () => {
        resolve(Buffer.concat(body).toString());
      });
    })
  }
}