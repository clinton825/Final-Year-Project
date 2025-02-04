require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { getProjectInfoByPlanningID } = require("./api/building_api");


const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Root route handler
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the Project Info API' });
});


app.get("/api/project/:planning_id", async (req, res) => {
  try {
    const { planning_id } = req.params;
    const project = await getProjectInfoByPlanningID(planning_id);

    if (project) {
      res.json({ status: "success", project });
    } else {
      res.status(404).json({ status: "error", message: "Project not found" });
    }
  } catch (error) {
    res.status(500).json({ status: "error", message: "Internal Server Error" });
  }
});


app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

async function printResult() {
  try {
    const result = await getProjectInfoByPlanningID('7360');
    console.log(result);
  } catch (error) {
    console.error(error);
  }
}

printResult();

