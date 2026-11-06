import type { OpenApiDefine, OpenApiResponse } from "@realsee/api";

// A small, fixed projection of the three public API operations this starter
// uses. @realsee/api owns request encoding and transport; this file declares
// content types and the Work query parameter, not a general proxy surface.
const json = {
  type: "object",
  contentType: "application/json",
  description: "",
  schema: { type: "object", description: "" },
} as const satisfies OpenApiResponse;

export const gatewayDefine: OpenApiDefine = {
  components: { schemas: {}, parameters: {}, requestBodies: {}, responses: {} },
  paths: {
    "/auth/access_token": {
      path: "/auth/access_token",
      description: "Exchange AK/SK on the local server.",
      methods: {
        post: {
          description: "",
          requestBody: {
            ...json,
            contentType: "application/x-www-form-urlencoded",
            required: true,
          },
          response: json,
        },
      },
    },
    "/open/v3/custom/search": {
      path: "/open/v3/custom/search",
      description: "List the configured Team’s VRs.",
      methods: {
        post: {
          description: "",
          requestBody: { ...json, required: true },
          response: json,
        },
      },
    },
    "/open/v3/vr/info": {
      path: "/open/v3/vr/info",
      description: "Resolve a previously listed VR.",
      methods: {
        get: {
          description: "",
          parameters: [
            {
              type: "object",
              in: "query",
              name: "resource_code",
              required: true,
              description: "",
              schema: { type: "string", description: "" },
            },
          ],
          response: json,
        },
      },
    },
  },
};
