// Small helpers shared by the Owner API controllers.

class ApiError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

// Wraps an async route handler: sends { success, data } on success and a
// { success:false, message } on failure (ApiError keeps its own status code).
const handle = (fn) => async (req, res) => {
    try {
        const result = await fn(req, res);
        if (res.headersSent) return;
        const { status = 200, message, ...rest } = result && result.__response ? result : { data: result };
        return res.status(status).json({ success: true, ...(message ? { message } : {}), ...rest });
    } catch (error) {
        if (error instanceof ApiError) {
            return res.status(error.status).json({ success: false, message: error.message });
        }
        console.error(`${req.method} ${req.originalUrl}:`, error);
        return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดของระบบ กรุณาลองใหม่อีกครั้ง' });
    }
};

// handle() wrapper for a custom status / message: return created(data, 'message')
const created = (data, message) => ({ __response: true, status: 201, data, message });
const ok = (data, message) => ({ __response: true, status: 200, data, message });

// branches.csv uses B001, every other table uses BR001 -> compare by the number
const toDataBranchId = (id) => {
    if (!id || id === 'all') return null;
    const match = String(id).match(/(\d+)\s*$/);
    return match ? 'BR' + String(Number(match[1])).padStart(3, '0') : null;
};

// next "PRD061" style id for a TEXT primary key column
async function nextId(db, table, column, prefix, width) {
    const [rows] = await db.query(
        `SELECT MAX(CAST(SUBSTRING(\`${column}\`, ?) AS UNSIGNED)) AS max_id FROM \`${table}\``,
        [prefix.length + 1]
    );
    return prefix + String((rows[0].max_id || 0) + 1).padStart(width, '0');
}

// "14/10/2026 22:30" - the text date format every table in the data set uses
const nowStamp = () => {
    const d = new Date();
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

// "2026-12-31" (date input) -> "31/12/2026"
const isoToThaiDate = (iso) => {
    const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${Number(m[3])}/${Number(m[2])}/${m[1]}` : null;
};

// "6/6/2027" / "4/10/2026 09:00" -> Date
const parseThaiDate = (text) => {
    const m = String(text || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    return m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : null;
};

// Staff only work with the branches listed in user_branch_access (ids like B003).
// dataBranchId is the BR### form used by the stock / order tables.
async function assertBranchAccess(db, userId, dataBranchId) {
    const [rows] = await db.query('SELECT branch_id FROM user_branch_access WHERE user_id = ?', [userId]);
    if (!dataBranchId || !rows.some((r) => toDataBranchId(r.branch_id) === dataBranchId)) {
        throw new ApiError(403, 'คุณไม่มีสิทธิ์เข้าถึงข้อมูลของสาขานี้');
    }
}

const num = (value) => (value === null || value === undefined || value === '' ? 0 : Number(value));

module.exports = { ApiError, handle, created, ok, toDataBranchId, nextId, num, nowStamp, isoToThaiDate, parseThaiDate, assertBranchAccess };
