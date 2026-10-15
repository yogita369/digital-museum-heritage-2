# MINI PROJECT ON INFRASTRUCTURE AS CODE (IaC)

## Project Title
**Automated Deployment of a Serverless Digital Museum and Heritage Information System Using Terraform**

---

## 1. Problem Statement

Modern cloud applications need several infrastructure components: compute services, storage, application configuration, environment variables, networking and deployment settings.

Traditionally, these resources are created by hand in a cloud provider's graphical dashboard. Manual configuration causes several problems:

- It is difficult to reproduce the same infrastructure.
- Human errors occur during configuration.
- Configuration changes are difficult to track.
- Recreating infrastructure after a failure needs manual effort.
- Different teams may create inconsistent environments.
- Infrastructure configuration cannot easily be version-controlled.
- Destroying and recreating an environment is time-consuming.

Infrastructure as Code (IaC) solves these problems by describing infrastructure configuration in source-code files.

In this mini project, students design and deploy a **Digital Museum and Heritage Information System** using **Terraform** as the Infrastructure as Code tool.

The application must be deployed on **Cloudflare Workers**, and artifact records must be stored in **Cloudflare Workers KV**.

Students must **not** create the Worker or KV namespace manually in the Cloudflare dashboard. These resources must be provisioned with Terraform.

The project must demonstrate the complete IaC lifecycle:

```
Define Infrastructure
        ↓
Initialize Terraform
        ↓
Validate Configuration
        ↓
Generate Execution Plan
        ↓
Provision Infrastructure
        ↓
Deploy Application
        ↓
Modify Infrastructure
        ↓
Update Infrastructure
        ↓
Destroy Infrastructure
        ↓
Recreate Infrastructure
```

Students must also store the project in GitHub and implement a basic CI/CD workflow using GitHub Actions.

---

## 2. Project Scenario

A city museum wants to digitise its heritage collection. Visitors, students and researchers should be able to browse the collection online, and museum curators should be able to catalogue and maintain the artifacts.

The museum's collection includes items such as:

- Bronze Nataraja sculpture (Chola Dynasty)
- Mauryan rock edict fragment
- Mughal court miniature painting
- Gupta-period gold coin
- Paithani silk saree
- Harappan painted pottery
- Palm-leaf manuscript

Each artifact record contains:

- Artifact ID
- Artifact Name
- Category
- Era / Period
- Origin
- Gallery
- Condition
- Exhibition Status
- Acquisition Year
- Description
- Created Date

Example:

```
Artifact ID       : ART-1001
Name              : Bronze Nataraja
Category          : Sculpture
Era / Period      : Chola Dynasty, 11th century CE
Gallery           : Gallery A - Bronzes
Condition         : Excellent
Exhibition Status : On Display
```

Instead of building the cloud infrastructure for this application by hand, the entire infrastructure must be defined and deployed with Terraform.

---

## 3. Main Objective

> To design, provision, deploy, modify, destroy and recreate a serverless cloud application infrastructure for a Digital Museum and Heritage Information System using Terraform-based Infrastructure as Code.

---

## 4. Learning Objectives

After completing the mini project, students should be able to:

1. Explain the concept of Infrastructure as Code.
2. Understand declarative infrastructure configuration.
3. Install and configure Terraform.
4. Configure a Terraform cloud provider.
5. Create cloud resources through Terraform.
6. Understand Terraform state management.
7. Use Terraform variables and outputs.
8. Provision serverless compute infrastructure.
9. Provision cloud storage using Terraform.
10. Connect an application to cloud storage.
11. Use Git for infrastructure version control.
12. Implement basic CI/CD for infrastructure deployment.
13. Explain the difference between manual deployment and IaC deployment.
14. Modify existing infrastructure through Terraform.
15. Destroy and recreate infrastructure automatically.

---

## 5. Technologies to Be Used

| Component | Technology |
|---|---|
| Infrastructure as Code | Terraform |
| Cloud Platform | Cloudflare |
| Compute | Cloudflare Workers |
| Data Storage | Cloudflare Workers KV |
| Application | HTML, CSS and JavaScript |
| API | JavaScript / Cloudflare Worker |
| Version Control | Git |
| Repository | GitHub |
| CI/CD | GitHub Actions |

Cloudflare officially supports Terraform, and its Terraform provider can manage Workers resources. Workers KV is available on both the Free and Paid plans.

---

## 6. Cost Requirement

Students should use the **Cloudflare Free plan**.

When this specification was prepared, the Workers Free plan allowed up to 100,000 Worker requests per day, which is more than enough for this mini project. Students do not need to buy a virtual machine or any paid cloud service.

---

## 7. Proposed System Architecture

```
                  VISITOR / CURATOR
                         |
                         v
                    Web Browser
                         |
                         v
                 Cloudflare Worker
                   /            \
                  v              v
          Web Interface      REST API
                                 |
                                 v
                       Cloudflare Workers KV
                                 |
                                 v
                         Artifact Records
```

The infrastructure itself is provisioned as:

```
              GitHub Repository
                     |
                     v
                 Terraform
                     |
          ----------------------
          |                    |
          v                    v
  Cloudflare Worker       Workers KV
          |
          v
  Digital Museum Application
```

After CI/CD is implemented:

```
Student modifies code
        ↓
git push
        ↓
GitHub Repository
        ↓
GitHub Actions
        ↓
Terraform
        ↓
Cloudflare
        ↓
Updated Application
```

---

## 8. Functional Requirements

The application must provide at least the following functions.

### FR1: Add Artifact
A curator must be able to catalogue a new artifact.
```
Name      : Bronze Nataraja
Category  : Sculpture
Era       : Chola Dynasty, 11th century CE
Status    : On Display
```

### FR2: View Artifacts
The application must display the stored artifacts.
```
------------------------------------------------------------------
ID         Artifact              Category     Era          Status
------------------------------------------------------------------
ART-1001   Bronze Nataraja       Sculpture    Chola        On Display
ART-1002   Rock Edict Fragment   Inscription  Mauryan      In Storage
```

### FR3: Update Artifact
A curator must be able to change an artifact's details, in particular its exhibition status.
```
Before:  ART-1001   Bronze Nataraja   On Display
After:   ART-1001   Bronze Nataraja   Under Restoration
```

### FR4: Delete Artifact
A curator must be able to remove an artifact record (for example, a duplicate entry or a de-accessioned item).

### FR5: Persistent Storage
Artifact records must be stored in Cloudflare Workers KV.

---

## 9. Required REST API

| Operation | Method & Path | Example |
|---|---|---|
| Create artifact | `POST /api/artifacts` | body below |
| Get all artifacts | `GET /api/artifacts` | |
| Get one artifact | `GET /api/artifacts/{id}` | `GET /api/artifacts/ART-1001` |
| Update artifact | `PUT /api/artifacts/{id}` | `{"status": "Under Restoration"}` |
| Delete artifact | `DELETE /api/artifacts/{id}` | |

Example create body:
```json
{
  "name": "Bronze Nataraja",
  "category": "Sculpture",
  "era": "Chola Dynasty, 11th century CE",
  "gallery": "Gallery A - Bronzes",
  "condition": "Excellent",
  "status": "On Display"
}
```

---

## 10. Infrastructure Requirements

The following must be managed with Terraform:

```
Terraform
    |
    +---- Cloudflare Worker
    |
    +---- Workers KV Namespace
    |
    +---- Worker/KV Binding
    |
    +---- Configuration / Variables
```

Students who create these resources manually in the Cloudflare dashboard should not receive full credit.

---

## 11. Prerequisites

- A laptop or desktop computer
- Internet connection
- Git installed
- GitHub account
- Cloudflare account
- Terraform installed
- VS Code or another editor
- Basic knowledge of HTML and JavaScript
- Basic understanding of REST APIs
- Basic command-line knowledge

---

## 12. Step-by-Step Implementation

### STEP 1: Create a Cloudflare Account
Create a Cloudflare account and check that you can open **Dashboard → Workers & Pages**.
Do not create the project infrastructure from the dashboard. You may use the dashboard only to view and verify resources that Terraform created.

### STEP 2: Install Terraform
```
terraform --version
```
Expected: `Terraform vX.X.X`. **Evidence:** screenshot of the installed version.

### STEP 3: Install Git
```
git --version
```

### STEP 4: Create Project Directory
```
digital-museum-heritage-iac/
├── terraform/
│   ├── providers.tf
│   ├── main.tf
│   ├── variables.tf
│   ├── outputs.tf
│   └── terraform.tfvars.example
├── application/
│   ├── worker.js
│   ├── index.html
│   ├── style.css
│   └── script.js
├── .github/workflows/deploy.yml
├── screenshots/
├── .gitignore
└── README.md
```

### STEP 5: Create Cloudflare API Token
Generate an API token with only the permissions the project needs (Workers Scripts: Edit, Workers KV Storage: Edit).
The token must **not** be written into `main.tf` or `providers.tf`. Use environment variables or GitHub Secrets.

### STEP 6: Configure Terraform Provider
Create `providers.tf` and configure the official Cloudflare provider inside `terraform { required_providers { ... } }`. Understand why providers are required:
```
Terraform → Cloudflare Provider → Cloudflare Account
```

### STEP 7: Declare Variables
Create `variables.tf`. At minimum, use variables for:
```
account_id
worker_name
kv_namespace_name
environment
```
Do not hard-code configuration values repeatedly.

### STEP 8: Create KV Namespace Through Terraform
Define a Workers KV namespace resource, for example `museum_artifacts`:
```
Terraform → Cloudflare Provider → Create KV Namespace → museum_artifacts
```
After deployment, verify it in the Cloudflare dashboard.

### STEP 9: Develop the Cloudflare Worker
Create `application/worker.js`. The Worker must:
1. Serve and respond to application requests.
2. Perform CRUD operations on Workers KV (GET, POST, PUT, DELETE).

### STEP 10: Connect Worker with KV
Bind the Worker to the KV namespace:
```
Worker
   |
   +------ ARTIFACTS_KV
               |
               v
          Workers KV
```
The application code then uses `ARTIFACTS_KV.put(...)`, `.get(...)`, `.list(...)` and `.delete(...)`.

### STEP 11: Create Terraform Output
Create `outputs.tf` returning, for example: Worker name, KV namespace ID and application URL.

### STEP 12: Initialize Terraform
```
terraform init
```
Expected: `Terraform has been successfully initialized!`. **Evidence:** screenshot.

### STEP 13: Format Terraform Code
```
terraform fmt
```
Explain: `terraform fmt` rewrites configuration files into the standard Terraform style.

### STEP 14: Validate Terraform Configuration
```
terraform validate
```
Expected: `Success! The configuration is valid.`. **Evidence:** screenshot.

### STEP 15: Generate Terraform Plan
```
terraform plan
```
The output should list resources such as `+ Worker`, `+ KV Namespace` and `+ Worker/KV configuration`. Understand the symbols `+` create, `~` modify and `-` destroy.
**Evidence:** screenshot with the resources to be created highlighted.

### STEP 16: Provision Infrastructure
```
terraform apply
```
Expected: `Apply complete!`. **Evidence:** screenshots of the apply, the Worker resource and the KV namespace.

### STEP 17: Verify Infrastructure
Verify that the Cloudflare Worker, the Workers KV namespace and the Worker-KV binding exist. You may use the dashboard to check, but Terraform must have created them.

### STEP 18: Test the Application
Open the deployed application and add an artifact:
```
Name     : Ajanta Cave Mural Fragment
Category : Painting
Era      : Vakataka period, 5th century CE
Status   : On Display
```
Check that the artifact appears.

### STEP 19: Test CRUD Operations

| Test case | Action | Expected result |
|---|---|---|
| TC1 | Create artifact | Artifact successfully created |
| TC2 | Read artifact | Previously created artifact is displayed |
| TC3 | Update artifact: status On Display → Under Restoration | Status changed successfully |
| TC4 | Delete artifact | Artifact removed successfully |

### STEP 20: Examine Terraform State
```
terraform show
```
Identify the resources recorded in state. Terraform uses state to map configuration to real infrastructure. Resources managed by Terraform should not also be changed by hand, because that causes state and configuration to disagree.

### STEP 21: Perform Infrastructure Modification Experiment
Change one infrastructure setting, such as `worker_name`, an environment variable or application configuration (for example, the museum name). Run `terraform plan` and observe the difference between current and desired infrastructure, then `terraform apply` and verify the change.

### STEP 22: Version Control Using Git
```
git init
git add .
git commit -m "Initial IaC project"
```
Create an empty GitHub repository and push. Keep meaningful commits, for example:
```
Initial Terraform configuration
Added KV namespace
Added Worker
Added Worker KV binding
Added CRUD API
Added museum web interface
Added GitHub Actions
Updated application
```

### STEP 23: Protect Sensitive Information
Never commit API tokens, secret keys, passwords, sensitive tfvars files, or Terraform state containing sensitive values. Add them to `.gitignore`. Explain why secrets must not be stored in a public Git repository.

### STEP 24: Configure GitHub Secrets
**Repository → Settings → Secrets and variables → Actions.** Add, for example, `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

### STEP 25: Create CI/CD Workflow
Create `.github/workflows/deploy.yml`:
```
Checkout repository → Install Terraform → terraform init → terraform validate → terraform plan → terraform apply
```
Document your deployment strategy.

### STEP 26: Trigger Automatic Deployment
Change the application title from **Digital Museum and Heritage Information System** to **Cloud-Based Digital Museum and Heritage Information System**, then:
```
git add .
git commit -m "Update application title"
git push
```
GitHub Actions should start automatically:
```
GitHub Push → GitHub Actions → Terraform → Cloudflare → Deployment
```
**Evidence:** screenshot of a successful GitHub Actions run.

### STEP 27: Demonstrate Terraform Destroy
```
terraform plan -destroy
terraform destroy
```
**Evidence:** screenshot of `Destroy complete!`.

### STEP 28: Verify Resource Removal
Verify in the dashboard that the Worker and KV namespace have been removed. This shows that the infrastructure lifecycle is controlled by code, not by manual cloud configuration.

### STEP 29: Recreate Entire Infrastructure
Without creating anything by hand, run `terraform plan` and then `terraform apply`. The whole environment should be recreated.
Explain: *because the required infrastructure is declared in Terraform configuration files, Terraform can reproduce the environment automatically.*

---

## 30. Mandatory IaC Demonstration

1. Show Terraform source code.
2. Run `terraform validate`.
3. Run `terraform plan`.
4. Explain the resources shown in the plan.
5. Run `terraform apply`.
6. Show the Worker that was created.
7. Show the KV namespace that was created.
8. Open the deployed application.
9. Add an artifact.
10. Retrieve the artifact.
11. Update the artifact.
12. Delete the artifact.
13. Modify the Terraform configuration.
14. Run `terraform plan` again.
15. Explain the detected difference.
16. Apply the modification.
17. Show the GitHub repository.
18. Show the GitHub Actions pipeline.
19. Run `terraform destroy`.
20. Demonstrate that the infrastructure can be recreated.

---

## 31. Expected Final Architecture

```
            Developer / Student
                    |
                 Git Push
                    v
            GitHub Repository
                    v
             GitHub Actions
                    v
                Terraform
                    |
           Cloudflare Provider
                    |
         +----------+----------+
         v                     v
 Cloudflare Worker        Workers KV
         |                     |
         +----------+----------+
                    v
   Digital Museum and Heritage Information System
                    v
         Visitors / Researchers / Curators
```

---

## 32. Mandatory Project Deliverables

- **A. Source code**: the complete project.
- **B. Terraform configuration**: `providers.tf`, `main.tf`, `variables.tf`, `outputs.tf`.
- **C. Application code**: the Worker/API and the frontend.
- **D. GitHub repository**: the complete project history.
- **E. CI/CD configuration**: `.github/workflows/deploy.yml`.
- **F. Screenshots**, at least: Terraform installation, `terraform init`, `terraform validate`, `terraform plan`, `terraform apply`, Cloudflare Worker, Workers KV, the working web application, create, update and delete operations, the GitHub repository, a GitHub Actions run, `terraform destroy`, and infrastructure recreation.
- **G. Mini project report**, with chapters:
  1. Introduction
  2. Background of Cloud Computing and IaC
  3. Problem Statement
  4. Proposed Architecture
  5. Technologies Used
  6. Terraform Configuration
  7. Application Implementation
  8. CI/CD Implementation
  9. Testing and Results
  10. Conclusion and Future Scope

---

## 33. Minimum Requirements for Project Acceptance

- Terraform configuration executes successfully.
- At least two cloud infrastructure components are provisioned.
- The Worker is created through Terraform.
- KV storage is created through Terraform.
- The application communicates with KV.
- CRUD functionality is demonstrated.
- Source code is maintained in Git.
- The project is stored in GitHub.
- Infrastructure modification is demonstrated.
- `terraform destroy` is demonstrated.
- Infrastructure recreation is demonstrated.

---

## 34. Additional Features for Higher Marks

- Curator login (only curators can add, edit or delete; visitors browse)
- Artifact categories (Sculpture, Painting, Manuscript, Coin, Textile, ...)
- Era / period and gallery information
- Search artifacts
- Filter by category, status or condition
- Sorting (by name, acquisition year, ID)
- Collection statistics (on display, in storage, under restoration, on loan)
- Multiple environments: dev, test, production

A particularly useful IaC enhancement:
```
terraform/
     +---- dev
     +---- test
     +---- production
```
This demonstrates how the same infrastructure code can create several environments.

---

## 35. Advanced IaC Extension

Investigate Terraform modules:
```
modules/
   +--- worker/
   +--- kv/
```
Infrastructure is then organised as reusable components:
```
Reusable Infrastructure → Terraform Modules → Standardised Deployment
```

---

## 36. Suggested Evaluation Scheme

| Component | Marks |
|---|---|
| Understanding of problem and architecture | 10 |
| Terraform configuration | 20 |
| Cloud infrastructure deployment | 15 |
| Worker and KV integration | 10 |
| Application functionality | 10 |
| Git and GitHub usage | 10 |
| CI/CD implementation | 10 |
| IaC modify/destroy/recreate demonstration | 10 |
| Viva and documentation | 5 |
| **Total** | **100** |

---

## 37. Important Evaluation Condition

Students should not receive full marks simply because the application works. The primary objective is **Infrastructure as Code**.

```
Application works  but  resources created manually   →  lower IaC marks

Terraform code → terraform apply → complete infrastructure → working application
                                                         →  the actual objective
```

---

## 38. Questions Students Must Answer in Their Report

1. What is Infrastructure as Code?
2. What problem does IaC solve?
3. Why is Terraform called a declarative IaC tool?
4. What is a Terraform provider?
5. What is a Terraform resource?
6. What is a Terraform variable?
7. What is a Terraform output?
8. What is Terraform state?
9. What happens during `terraform init`?
10. What happens during `terraform plan`?
11. What happens during `terraform apply`?
12. What happens during `terraform destroy`?
13. Why should infrastructure not be modified manually after Terraform manages it?
14. Why should API tokens not be stored in Terraform source code?
15. What is a KV database?
16. Why was serverless computing selected for this project?
17. What is CI/CD?
18. What role does GitHub Actions perform?
19. How can Terraform recreate infrastructure after deletion?
20. What is infrastructure drift?

---

## 39. Suggested Viva Questions

**Basic**
- Q1. What is IaC? *Defining and managing infrastructure through machine-readable configuration files instead of creating resources by hand.*
- Q2. Which IaC tool have you used? *Terraform.*
- Q3. Which cloud provider have you used? *Cloudflare.*
- Q4. Which compute service have you used? *Cloudflare Workers.*
- Q5. Which storage service have you used? *Cloudflare Workers KV.*

**Intermediate**
- Q6. What does `terraform init` do? *Initialises the working directory and downloads the required providers and modules.*
- Q7. What does `terraform plan` do? *Compares the desired configuration with the current state and real infrastructure, and shows the changes it proposes.*
- Q8. What does `terraform apply` do? *Carries out the planned changes.*
- Q9. What does `terraform destroy` do? *Removes the infrastructure managed by the configuration.*
- Q10. What is Terraform state? *The record Terraform uses to link declared resources to real infrastructure.*

**Advanced**
- Q11. What is infrastructure drift? *When the real infrastructure differs from what Terraform defines.*
- Q12. What happens if someone changes a Terraform-managed resource by hand? *The next plan detects the difference and proposes to bring the resource back in line with the configuration.*
- Q13. Why use variables? *They make configurations reusable and avoid hard-coding.*
- Q14. Why use modules? *They provide reusable, organised infrastructure components.*
- Q15. What does Git add to IaC? *Version history, collaboration, auditing, rollback and change tracking.*

---

## 40. Final Expected Outcome

```
Write Infrastructure Code → terraform init → terraform validate → terraform plan
→ terraform apply → Infrastructure Created → Application Running
→ Modify Configuration → terraform plan → terraform apply → Infrastructure Updated
→ terraform destroy → Infrastructure Removed → terraform apply → Infrastructure Recreated
```

Key learning outcome: *the infrastructure an application needs can be created, modified, removed, version-controlled and recreated automatically through code instead of manual configuration.*

---

## 41. Suggested Duration (3–4 weeks)

| Week | Work |
|---|---|
| 1 | IaC concepts, Terraform installation, Cloudflare account, provider configuration, basic Terraform commands |
| 2 | Worker, Workers KV, Terraform resources, museum application development |
| 3 | CRUD operations, testing, Git/GitHub, infrastructure modification |
| 4 | GitHub Actions, destroy/recreate experiment, report preparation, final viva |

---

## 42. Submission Title

> **"Automated Deployment of a Serverless Digital Museum and Heritage Information System Using Terraform-Based Infrastructure as Code"**

### Core Requirement
The project is evaluated mainly on the student's ability to demonstrate:

**Infrastructure Definition → Automated Provisioning → Version Control → Modification → CI/CD → Destruction → Reproducible Recreation**

and not only on how the museum application looks.
