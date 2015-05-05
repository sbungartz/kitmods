# kitmods
Planning your Master program at Karlsruhe Institute of Technology (KIT) in Informatics involves choosing courses ("Lehrveranstaltungen"),
placing them in modules ("Module") which form specializations ("Fächer").
Your plan also has to comply with a veriety of constraints.
The "Modulhandbuch" listing courses, modules and specializations is a 900 page PDF file.
It works, but it is not easy to handle.

The goal of this project is to make an app that allows people to interactively plan their KIT Master program,
visualizing constraints and provide filters and specialized views for things they find interesting.

It is currently a work in progress and it is not even completly clear what it should be capable of.

## Datasource
The information on the modules has been parsed from the "Modulhandbuch" PDF and formatted as json (see `data` folder).
It currently has some issues (duplicate module IDs have been found) and does not contain all the information on a module
or course from the PDF.

## Datastore
As you use the app you select courses and modules and make a plan for your Master program.
This plan is stored locally in your browser only.
You can Download it as a JSON file and (in the future) will be able to load it from file again.

## Disclaimer
There is *no* guarantee for the completeness or correctness of any information in this app.
Once you selected your courses, modules and specializations you should definitely consult the "Modulhandbuch" on the 
general constraints as well as possible additional constraints listed in the descriptions of the respective courses and modules.
