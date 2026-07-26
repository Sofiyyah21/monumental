import express from "express";
const app = express();

app.get("/api/v1/health", (req, res) => {
    res.json({
      success: true,
      data: {
        status: "ok",
      },
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});