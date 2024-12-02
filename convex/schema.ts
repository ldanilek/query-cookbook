import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.string(),
    tokenIdentifier: v.string(),
    status: v.union(v.literal("active"), v.literal("inactive")),
  }).index("by_token", ["tokenIdentifier"])
  .index("by_name", ["name"]),
});
