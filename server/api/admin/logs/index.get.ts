import { defineEventHandler, createError, getQuery } from "h3";

/**
 * 获取全站API调用日志
 */
export default defineEventHandler(async (event) => {
  // 安全检查 - 这里应添加实际的认证检查
  // TODO: 实现管理员认证

  try {
    const query = getQuery(event);

    // 获取分页参数
    const limit = parseInt(query.limit as string) || 20;
    const offset = parseInt(query.offset as string) || 0;

    // 获取筛选条件
    const routeId = query.routeId ? parseInt(query.routeId as string) : null;
    const status = query.status ? parseInt(query.status as string) : null;
    const ipAddress = (query.ipAddress as string) || null;
    const startDate = (query.startDate as string) || null;
    const endDate = (query.endDate as string) || null;

    const env = event.context.cloudflare.env;

    // 构建查询条件
    const whereConditions = [];
    const queryParams = [];

    if (routeId) {
      whereConditions.push("api_logs.route_id = ?");
      queryParams.push(routeId);
    }

    if (status) {
      whereConditions.push("api_logs.response_status = ?");
      queryParams.push(status);
    }

    if (ipAddress) {
      whereConditions.push("api_logs.ip_address LIKE ?");
      queryParams.push(`%${ipAddress}%`);
    }

    if (startDate) {
      whereConditions.push("api_logs.created_at >= ?");
      queryParams.push(startDate);
    }

    if (endDate) {
      whereConditions.push("api_logs.created_at <= ?");
      queryParams.push(endDate);
    }

    // 构建WHERE子句
    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(" AND ")}`
        : "";

    // 获取日志总数
    const countSql = `
      SELECT COUNT(*) as total FROM api_logs 
      LEFT JOIN api_routes ON api_logs.route_id = api_routes.id
      ${whereClause}
    `;

    const countResult = await env.DB.prepare(countSql)
      .bind(...queryParams)
      .first();

    // 查询API调用日志
    const querySql = `
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
      ${whereClause}
      ORDER BY api_logs.created_at DESC
      LIMIT ? OFFSET ?
    `;

    // 添加分页参数
    const queryParamsWithPagination = [...queryParams, limit, offset];

    const { results, error } = await env.DB.prepare(querySql)
      .bind(...queryParamsWithPagination)
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
