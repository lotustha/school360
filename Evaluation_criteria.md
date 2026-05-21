Technical Design Document: Integrated School Management & Grade Evaluation System

1. Executive Introduction and Strategic Alignment

In accordance with the mandates set forth by the Curriculum Development Centre (CDC) of Nepal, the educational landscape is undergoing a critical strategic transition from traditional, terminal examinations toward a holistic internal evaluation system. This shift, formalized under the National Curriculum Framework, is no longer an optional pedagogical preference but a compliance necessity for educational institutions. The framework reallocates 50% of the total assessment weightage to internal evaluations, a move designed to capture a student's true competency across various domains. However, the resulting complexity of tracking daily attendance, participation, oral performance, and creative projects demands a robust, automated software solution. Our system serves as the technical backbone for this transition, ensuring the complex 50-point internal assessment is managed with mathematical precision and regulatory integrity.

This system is built upon the "Learning by Doing" philosophy and project-based learning methodologies emphasized in current government evaluation mandates. By moving away from rote memorization toward experiential learning, the curriculum requires a data-driven approach to maintain objectivity in grading. Software automation is essential to transform qualitative experiences—such as field trips, storytelling, and model making—into standardized, quantitative performance metrics. The following design specifications outline the functional requirements and data architecture necessary to bridge the gap between progressive pedagogy and objective, compliant academic assessment.

2. Domain Analysis: The 50-Point Internal Evaluation Framework

To maintain full compliance with the National Curriculum Standards, the software must strictly enforce the standardized assessment categories for Grades 4–8. The system is architected to handle discrete data inputs across four primary pillars, ensuring that the 50-point internal total is derived from a balanced set of competencies.

Evaluation Area Total Marks Sub-Categories & Technical Metrics
Participation 4 Marks Attendance (2 marks) and Learning Participation (2 marks).
Listening and Speaking 20 Marks Dictation/Listening (12): Word-based dictation and listening comprehension. Oral Response (8): Performance in dialogue and oral expression.
Reading and Writing 16 Marks Pronunciation/Fluency (6): Word pronunciation and rhythmic reading. Comprehension/Response (4): Analysis of text. Handwriting/Project Work (6): Creative and technical writing.
Quarterly Exams 10 Marks Standardized periodic testing performance.

The "So What?" layer of this data framework lies in its ability to provide a competency heat-map of student performance. By decomposing a single grade into these specific sub-categories, the system allows educators to distinguish between a student's Phonetic Skills (demonstrated through Pronunciation and Dictation) and their Syntactic or Analytical Skills (demonstrated through Creative Writing and Comprehension). This granular visibility enables targeted educational interventions that a single terminal exam score cannot provide. To achieve this, the software accounts for age-specific variables defined by the CDC, such as dictation tests consisting of 20 words for Grades 4–5 and 24 words for Grades 6–8.

3. Proposed System Architecture and Data Structure

The implementation utilizes a relational database architecture to preserve the longitudinal integrity of student progress. This structure is vital for maintaining a "Source of Truth" for student achievement over multiple terms, which is required for official government audit trails.

Student Profile Entity This entity acts as the primary key for all academic records, containing unique student identifiers, grade level, and demographic data required for centralized reporting.

Evaluation Ledger Entity The ledger is the central repository for all internal assessment inputs. It is structured with the following granular fields and constraints:

- attendance_score: Integer (0–2), representing physical presence.
- participation_activity_score: Integer (0–2), capturing classroom engagement.
- listening_dictation_raw_total: Integer (Range 0–20 for Grades 4-5; 0–24 for Grades 6-8), representing the raw count of correct words.
- oral_expression_score: Integer (0–8), reflecting verbal communication skills.
- creative_writing_project_id: Foreign key linking to a specific project rubric or digital submission.

Subject and Criteria Mapping The system uses a flexible relationship between the Subject entity and the Evaluation_Criteria entity. This ensures the software can handle the specific curriculum requirements for all mandatory subjects as listed in the national standards:

- Nepali
- English
- Science & Technology
- Mathematics
- Health, Physical, and Creative Arts
- Social Studies and Human Values

This architecture ensures that as teachers enter raw classroom data, the system maintains referential integrity across the entire academic curriculum.

4. The Evaluation Algorithm: Program Logic Start-to-Finish

Algorithmic transparency is fundamental to maintaining trust between the institution, the students, and the parents. The software eliminates "black-box" grading by providing a clear, auditable logic flow from raw activity to the final internal mark.

Developer Logic Flow:

1. Data Ingestion: The teacher inputs raw scores from specific classroom activities, such as the total words correct in a dictation exercise or a rubric-based score for a project.
2. Normalization: The algorithm performs a mapping of raw counts to weighted scales. For example, in the Listening category, a raw score of 20/20 (Grades 4-5) or 24/24 (Grades 6-8) is normalized to the 12-mark scale mandated by the framework.
3. Aggregation: The system sums the weighted results from the four pillars (Participation, Listening/Speaking, Reading/Writing, and Quarterly Exams) to reach the 50-point internal total.
4. Averaging and GP Calculation: Following the requirements of the official "Form-7" record, the system calculates both the total marks and the "Average," which in this context refers to the standardized Grade Point (GP) equivalent of the 50-point total.

The importance of this logic lies in the automated feedback loop. The system does more than record grades; it identifies if a student's struggle is localized to "Pronunciation" (a phonetic skill) versus "Creative Writing" (a syntactic/expressive skill). This automation allows teachers to shift their focus from manual calculation to high-value instructional support.

5. Report Design: The Internal Evaluation Record (Form-7)

To satisfy regulatory reporting requirements, the system generates digital grade sheets that mirror the "Internal Evaluation Criteria Form (Form-7)" provided by government authorities. This ensures that digital records are ready for export and official submission without further manual formatting.

Digital Student Grade Sheet Layout:

- Header: Comprehensive metadata including Student Name, Class, Academic Session, and Evaluation Period (e.g., First Quarter).
- Body: A multi-column structure formatted as follows: S.N. | Name | Participation (4) | Listening/Speaking (20) | Reading/Writing (16) | Quarterly Exam (10) | Total (50) | Average (GP).
- Teacher Feedback Section: A standardized field for qualitative remarks. This section includes mandatory prompts for "Creative Suggestions," aligning with the methodology of the National Curriculum Framework which prioritizes forward-looking, constructive feedback over simple performance summaries.

6. Developer’s Step-by-Step Implementation Roadmap

The development lifecycle is designed to produce a professional, high-reliability tool that remains intuitive for educators who are not technical specialists.

Chronological Guide:

1. Environment Setup: Provisioning a full-stack environment capable of handling relational data and generating high-fidelity, print-ready PDF reports.
2. Schema Migration: Building the relational tables for students, subjects, and the evaluation ledger, ensuring constraints are applied at the database level.
3. Module Development (Project Work): Implementing the "Project-based Learning" module. This module must be pre-loaded with rubric templates for CDC-approved activities such as "Field Trips," "Storytelling," and "Model Making."
4. Validation Layer: Implementing a strict enforcement layer that prevents data entry errors. The system must throw a ValueExceededError if a user attempts to enter a score above the government-mandated caps (e.g., attempting to enter '5' for a Participation field capped at '4').
5. Reporting Engine: Developing the export logic to generate the Form-7 standardized reports in a print-ready format.

By following this roadmap, the resulting software transforms the manual, error-prone tasks of traditional grading into a streamlined, professional workflow. It empowers educators to fulfill their administrative duties with precision while providing the analytical insights necessary to improve student learning outcomes.
