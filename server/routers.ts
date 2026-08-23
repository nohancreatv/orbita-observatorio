import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { getEpicImages, getIssClosestPass, getNearEarthAsteroids, getObservingConditions, getOrbitSnapshot, getOrbitSnapshots, getPlaceImage, getSpaceStory, getSpaceWeather, getUpcomingLaunches, resolveGroundLocation, SATELLITE_CATALOG } from "./orbitService";
import { isRateLimited } from "./security";

const satelliteIdSchema = z.enum(["iss", "hubble", "tiangong", "noaa19"]);
const coordinateSchema = z.number().finite();

const orbitPublicProcedure = publicProcedure.use(({ ctx, next }) => {
  const requestIdentity = ctx.req.ip || ctx.req.socket.remoteAddress || "anonymous";
  if (isRateLimited(requestIdentity)) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Muitas consultas em pouco tempo. Aguarde um minuto para tentar novamente." });
  }
  return next();
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  orbit: router({
    catalog: orbitPublicProcedure.query(() => Object.values(SATELLITE_CATALOG)),
    allSnapshots: orbitPublicProcedure.query(() => getOrbitSnapshots()),
    snapshot: orbitPublicProcedure.input(z.object({ satelliteId: satelliteIdSchema })).query(({ input }) => getOrbitSnapshot(input.satelliteId)),
    userPlace: orbitPublicProcedure.input(z.object({ latitude: coordinateSchema.min(-90).max(90), longitude: coordinateSchema.min(-180).max(180) })).mutation(({ input }) => resolveGroundLocation(input.latitude, input.longitude)),
    issClosestPass: orbitPublicProcedure.input(z.object({ latitude: coordinateSchema.min(-90).max(90), longitude: coordinateSchema.min(-180).max(180) })).mutation(({ input }) => getIssClosestPass(input.latitude, input.longitude)),
  }),
  space: router({
    story: orbitPublicProcedure.query(() => getSpaceStory()),
    launches: orbitPublicProcedure.query(() => getUpcomingLaunches()),
    epic: orbitPublicProcedure.query(() => getEpicImages()),
    weather: orbitPublicProcedure.query(() => getSpaceWeather()),
    asteroids: orbitPublicProcedure.query(() => getNearEarthAsteroids()),
    placeImage: orbitPublicProcedure
      .input(z.object({ latitude: coordinateSchema.min(-90).max(90), longitude: coordinateSchema.min(-180).max(180) }))
      .query(({ input }) => getPlaceImage(input.latitude, input.longitude)),
  }),
  observation: router({
    conditions: orbitPublicProcedure.input(z.object({ latitude: coordinateSchema.min(-90).max(90), longitude: coordinateSchema.min(-180).max(180) })).query(({ input }) => getObservingConditions(input.latitude, input.longitude)),
  }),
});

export type AppRouter = typeof appRouter;
