import executeQuery from '../utils/mysql.js';

const getSettingByName = async (name) => {
    const data = await executeQuery("SELECT * FROM settings WHERE name = ? LIMIT 1", [name]);
    return data.length > 0 ? data[0] : null;
};

const getAllSettings = async () => {
    const data = await executeQuery("SELECT * FROM settings ORDER BY name ASC", []);
    return data;
};

const getSettingsAsObject = async () => {
    const settings = await getAllSettings();
    const settingsObject = {};
    
    settings.forEach(setting => {
        settingsObject[setting.name] = setting.value;
    });
    
    return settingsObject;
};

const updateSetting = async (name, value) => {
    const data = await executeQuery(
        "UPDATE settings SET value = ?, updated_at = NOW() WHERE name = ?",
        [value, name]
    );
    return data;
};

const createSetting = async (name, value) => {
    const data = await executeQuery(
        "INSERT INTO settings (name, value) VALUES (?, ?)",
        [name, value]
    );
    return data;
};

const upsertSetting = async (name, value) => {
    const existing = await getSettingByName(name);
    
    if (existing) {
        return await updateSetting(name, value);
    } else {
        return await createSetting(name, value);
    }
};

const deleteSetting = async (name) => {
    const data = await executeQuery("DELETE FROM settings WHERE name = ?", [name]);
    return data;
};

// Cache for settings to avoid frequent database queries
let settingsCache = null;
let cacheTime = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const getCachedSettings = async () => {
    const now = Date.now();
    
    if (!settingsCache || !cacheTime || (now - cacheTime) > CACHE_DURATION) {
        settingsCache = await getSettingsAsObject();
        cacheTime = now;
    }
    
    return settingsCache;
};

const clearCache = () => {
    settingsCache = null;
    cacheTime = null;
};

const getSetting = async (name, defaultValue = null) => {
    const settings = await getCachedSettings();
    return settings[name] !== undefined ? settings[name] : defaultValue;
};

export {
    getSettingByName,
    getAllSettings,
    getSettingsAsObject,
    updateSetting,
    createSetting,
    upsertSetting,
    deleteSetting,
    getCachedSettings,
    clearCache,
    getSetting
};