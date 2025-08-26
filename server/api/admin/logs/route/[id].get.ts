import { defineEventHandler, getRouterParam, createError, getQuery } from "h3";

/**
 * 获取特定API路由的调用日志
 */
export default defineEventHandler(async (event) => {
  // 安全检查 - 这里应添加实际的认证检查
  // TODO: 实现管理员认证

  try {
    const id = getRouterParam(event, "id");
    const query = getQuery(event);

    // 获取分页参数
    const limit = parseInt(query.limit as string) || 20;
    const offset = parseInt(query.offset as string) || 0;

    if (!id || isNaN(Number(id))) {
      throw createError({
        statusCode: 400,
        statusMessage: "API ID无效",
      });
    }

    const env = event.context.cloudflare.env;

    // 首先验证API路由是否存在
    const route = await env.DB.prepare(`SELECT id FROM api_routes WHERE id = ?`)
      .bind(id)
      .first();

    if (!route) {
      throw createError({
        statusCode: 404,
        statusMessage: "API路由未找到",
      });
    }

    // 获取该API的调用日志总数
    const countResult = await env.DB.prepare(
      `SELECT COUNT(*) as total FROM api_logs WHERE route_id = ?`
    )
      .bind(id)
      .first();

    // 查询API调用日志
    const { results, error } = await env.DB.prepare(
      `
      SELECT 
        api_logs.id,
        api_logs.route_id,
        api_logs.ip_address,
        api_logs.request_data,
        api_logs.response_status,
        api_logs.execution_time,
        api_logs.created_at,
        api_routes.name as api_name,
        api_routes.path as api_path,
        api_routes.method as api_method
      FROM api_logs
      LEFT JOIN api_routes ON api_logs.route_id = api_routes.id
      WHERE api_logs.route_id = ?
      ORDER BY api_logs.created_at DESC
      LIMIT ? OFFSET ?
    `
    )
      .bind(id, limit, offset)
      .all();

    if (error) {
      throw createError({
        statusCode: 500,
        statusMessage: `数据库错误: ${error}`,
      });
    }

    return {
      success: true,
      logs: results,
      meta: {
        total: countResult ? countResult.total : 0,
        limit,
        offset,
      },
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
