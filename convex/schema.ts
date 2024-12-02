import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  messages: defineTable({
    author: v.string(),
    conversation: v.string(),
    body: v.string(),
    hidden: v.boolean(),
  }).index("by_author", ["author"])
  .index("by_conversation", ["conversation"])
  .searchIndex("by_body", { searchField: "body" }),
})
