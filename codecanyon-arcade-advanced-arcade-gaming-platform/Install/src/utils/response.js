const response = (res, status, message = false, data = false) => {
    return res.status(200).json({
        status,
        message,
        data
    });
}

export default response;