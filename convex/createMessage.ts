import { v } from "convex/values";
import { mutation } from "./_generated/server";

// Mutation to create a message for testing.
export default mutation({
  args: {
    author: v.string(),
    conversation: v.string(),
    body: v.string(),
    hidden: v.boolean(),
  },
  handler: async (ctx, args) => {
    ctx.db.insert("messages", args);
  },
});
