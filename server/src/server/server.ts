import * as http from "http";
import {Buffer} from "node:buffer";
import {ErrorLog} from "../transpiler/utils";
import Session from "./session";

const ERROR_CODE = {
  COMPILE_ERROR: 460,
  LINK_ERROR: 461
}

export default class HttpServer {
  readonly PORT = 8080;
  server: http.Server;
  session?: Session;

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
    let requestBody: string;

    try {
      requestBody = await this.getRequestBody(request);
      switch (request.url) {
        case "/repl-compile":
          if (!this.session) { this.session = new Session(); }
          responseBody = this.session.execute(JSON.parse(requestBody).src, false);
          statusCode = 200;
          break;
        case "/repl-compile-with-flash":
          if (!this.session) { this.session = new Session(); }
          responseBody = this.session.execute(JSON.parse(requestBody).src, true);
          statusCode = 200;
          break;
        case "/set-flash-address":
          if (!this.session) { this.session = new Session(); }
          const requestBodyJson = JSON.parse(requestBody);
          console.log("flash address", requestBodyJson.address);
          this.session.setFlashAddress(requestBodyJson.address);
          responseBody = {};
          statusCode = 200;
          break;
        case "/clear":
          this.session = new Session();
          responseBody = {};
          statusCode = 200;
          break;
        default:
          responseBody = {message: "Page not found."};
          statusCode = 404;
          break;
      }
    } catch (e) {
      console.log(e);
      if (e instanceof ErrorLog) {
        responseBody = {message: e};
        statusCode = ERROR_CODE.COMPILE_ERROR;
      } else {
        responseBody = {message: e};
        statusCode = 500;
      }
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