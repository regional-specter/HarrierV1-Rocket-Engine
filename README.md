<div align="center">

<img width="1470" height="376" alt="image" src="https://github.com/user-attachments/assets/b2750115-e1a9-49fd-a682-90c5cdeffddc" />


# Viper-1 Rocket Engine
<p>
  <img src="https://img.shields.io/badge/Propellant-LOX%2FRP--1-f97316" alt="LOX/RP-1 Bipropellant">
  <img src="https://img.shields.io/badge/Nozzle-de%20Laval%20%2B%20TVC-22c55e" alt="de Laval + TVC">
  <img src="https://img.shields.io/badge/Stack-Python%20%7C%20Blender%20%7C%20LaTeX-3776AB" alt="Tech Stack">
</p>

The Viper-1 is a 3-month engineering and 3D visualization project aimed at designing a theoretical, highly stable gas-generator rocket engine. Inspired by the rugged simplicity of SpaceX’s Falcon/Merlin architecture and the high-agility vectoring systems of modern fighter jets, this project bridges computational physics, structured programming, advanced mechanical rigging, and academic research.
</div>

The project is divided into three core deliverables hosted in a clean GitHub repository:

1. Computational Backend (Python): Scripts calculating thermodynamic properties, fuel stoichiometry, mass flow rates, and nozzle expansion profiles.
2. Technical Research Paper (LaTeX): A formal, publication-style document detailing the mathematical proofs, engineering tradeoffs, and system architecture.
3. Interactive 3D Asset (Blender): A fully rigged, animation-ready 3D model featuring a robust combustion base and an advanced, articulating Thrust Vector Control (TVC) nozzle.

## Core Engine Goals & Philosophy
- **Foundational Reliability**: Keep the primary combustion chamber, injector plate, and fuel feed architecture straightforward and predictable to ensure sustainable, steady-state combustion that "doesn't blow up."
- **Advanced Vectoring Agility**: Push technical complexity into the exhaust nozzle and gimbal mechanism, using dual-axis actuators for precision flight control and thrust vectoring.
- **Rigorous Documentation**: Leverage Python data science workflows to validate every mechanical dimension before modeling it in 3D.

## Project Breakdown
### 1. Fuel Selection & Thermodynamic Analysis (Python)

* **Propellant Pairing:** Liquid Oxygen (LOX) as the oxidizer and Refined Kerosene (RP-1) as the fuel.
* **Why it fits:** It mirrors the Falcon fleet, offering a high energy density, manageable storage compared to cryogenic hydrogen, and well-documented chemical kinetics.
* **Python Implementation:**
  * Calculating stoichiometric mixture ratios ($O/F$ ratio).
  * Modeling adiabatic flame temperatures and characteristic exhaust velocity ($c^*$ ).
  * Automating mass flow rate ($\dot{m}$) and pressure drop equations across the injector face.



### 2. Core Engine Mechanics & Thermodynamics

* **Combustion Chamber Design:** A cylindrical mixing and combustion zone engineered to withstand high pressures while maintaining simple, thick-walled thermal margins.
* **Cooling Strategy:** Conceptualizing basic regenerative cooling channels (where fuel pre-cools the chamber walls before injection) to ensure structural sustainability.
* **Physics Equations:** Implementing conservation of energy, mass, and momentum to govern the transition from low-speed injection to high-temperature gas expansion.

### 3. Advanced Nozzle Design & Thrust Vector Control (TVC)

* **The de Laval Nozzle:** Designing the converging-diverging geometry using gas dynamics equations to expand combustion gases past Mach 1. Area ratio ($A/A^*$) calculations handled via Python scripts.
* **Gimbal Ring Mechanism:** Integrating a two-axis pivot ring mounted around the throat.
* **Actuation System:** Designing mechanical attachment points for hydraulic or electromechanical actuators in Blender to simulate real-time vector tilting without losing structural integrity.

### 4. Computational Backend & GitHub Architecture

* **Codebase Structure:** Organizing Python scripts (`/calculators`), LaTeX documentation (`/docs`), and Blender project files (`/blender`) into a clean, professional repository.
* **Data Pipelines:** Exporting pressure, temperature, and Mach number profiles as CSV datasets from Python to verify nozzle expansion curves.

### 5. Digital Modeling & Rigging (Blender)

* **Hard-Surface Modeling:** Constructing the engine components to precise scale based on Python calculations—from the propellant inlet manifolds down to the flared nozzle exit.
* **Rigging & Animation:** Setting up custom bone hierarchies and constraints for the gimbal actuators so the nozzle smoothly pivots and tracks target vectors.
* **Shading & Texturing:** Applying procedural industrial shaders (brushed metal, carbon-composite thermal blankets, and high-temperature exhaust soot discoloration).

### 6. Academic Documentation (LaTeX)

* **Research Paper:** Writing a formal paper detailing the mathematical derivations, fluid dynamics models, and design choices.
* **Visual Integration:** Embedding the Python-generated performance charts and high-resolution Blender renders directly into the LaTeX layout to create a comprehensive portfolio centerpiece.
