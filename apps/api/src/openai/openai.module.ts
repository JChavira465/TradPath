import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import { OPENAI_CLIENT } from "./openai.constants";
import { OpenAiService } from "./openai.service";

@Global()
@Module({
  providers: [
    {
      provide: OPENAI_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const apiKey = config.get<string>("OPENAI_API_KEY");
        if (!apiKey) return null;
        return new OpenAI({ apiKey });
      },
    },
    OpenAiService,
  ],
  exports: [OpenAiService],
})
export class OpenAiModule {}
