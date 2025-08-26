import { defineEventHandler, createError } from "h3";

/**
 * 获取所有API路由简要信息，用于日志筛选
 */
export default defineEventHandler(async (event) => {
  // 安全检查 - 这里应添加实际的认证检查
  // TODO: 实现管理员认证

  try {
    const env = event.context.cloudflare.env;

    // 查询所有API路由基本信息
    const { results, error } = await env.DB.prepare(
      `
      SELECT id, name, path, method
      FROM api_routes
      ORDER BY name ASC
    `
    ).all();

    if (error) {
      throw createError({
        statusCode: 500,
        statusMessage: `数据库错误: ${error}`,
      });
    }

    return {
      success: true,
      routes: results,
    };
  } catch (error: any) {
    if (error.statusCode) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      statusMessage: `服务器错误: ${error.message || "未知错误"}`,
    });
  }
});
