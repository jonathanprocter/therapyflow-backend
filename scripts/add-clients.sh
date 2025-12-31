#!/bin/bash

API_URL="https://therapyflow-backend-1.onrender.com/api/clients"

# Array of clients with full name and DOB (name|dob format)
declare -a clients=(
  "Adelaida Mongelli|1996-11-30"
  "Amberly Comeau|1998-09-25"
  "Andrew Ross|1989-08-24"
  "Angelica Ruden|1995-02-24"
  "Ava Moskowitz|2006-09-26"
  "Billy Aymami|1972-07-01"
  "Brian Kolsch|2002-02-17"
  "Brianna Brickman|1995-09-19"
  "Caitlin Dunn|1997-07-21"
  "Calvin Hill|1996-03-17"
  "Carlos Guerra|1989-02-02"
  "Christopher Balabanick|1998-10-28"
  "Dan Settle|1965-09-01"
  "David Grossman|1962-01-03"
  "Freddy Junior Rodriguez|1985-03-11"
  "Gavin Fisch|2006-09-12"
  "Gavin Perna|2003-09-27"
  "Hector Mendez|1965-09-02"
  "James Fusco|2004-10-14"
  "James Wright|2002-05-25"
  "Jaquan Williams|1986-12-26"
  "Jared Vignola|2003-05-17"
  "Jason Laskin|1994-09-29"
  "Jennifer McNally|1993-01-11"
  "Jerry MacKey|1984-09-20"
  "John Best|1962-06-01"
  "Jordano Sanchez|1991-06-09"
  "Karen Foster|1993-08-27"
  "Kenneth Doyle|1996-02-23"
  "Kieran Kriss|1990-02-08"
  "Krista Flood|2003-05-02"
  "Kristi Rook|1974-01-25"
  "Lindsey Grossman|1993-03-03"
  "Luke Knox|1998-01-06"
  "Mary Camarano|1995-03-19"
  "Maryellen Dankenbrink|1991-12-24"
  "Matthew Michelson|1999-10-10"
  "Matthew Paccione|1986-04-09"
  "Max Hafker|2005-07-27"
  "Max Moskowitz|2000-06-04"
  "Meera Zucker|1981-06-05"
  "Michael Bower|1962-09-27"
  "Michael Cserenyi|1990-03-27"
  "Michael Neira|1994-02-18"
  "Nancy Grossman|1963-11-24"
  "Nicholas Bonomi|1992-05-22"
  "Nick Dabreu|1990-09-02"
  "Nico Luppino|1992-07-13"
  "Nicola Marasco|1994-12-05"
  "Noah Silverman|2004-08-28"
  "Owen Lennon|2006-02-11"
  "Paul Benjamin|1995-09-04"
  "Richard Hayes|1964-11-05"
  "Robert Abbot|1962-11-29"
  "Robert Delmond|1963-01-10"
  "Ruben Spilberg|1988-01-18"
  "Sacha Jones|1992-09-29"
  "Sarah Palladino|1993-08-10"
  "Sarah Thomas|1990-03-15"
  "Sherrifa Hoosein|1986-12-18"
  "Steven Deluca|1996-09-08"
  "Susan Hannigan|1990-07-04"
  "Tom Remy|1988-05-09"
  "Trendall Storey|2006-06-13"
  "Valentina Gjidoda|1988-09-01"
  "Vivian Meador|1962-04-23"
)

echo "Adding clients to TherapyFlow..."
echo ""

added=0
failed=0

for client in "${clients[@]}"; do
  IFS='|' read -r name dob <<< "$client"

  response=$(curl -s -w "\n%{http_code}" -X POST "$API_URL" \
    -H "Content-Type: application/json" \
    -d "{
      \"name\": \"$name\",
      \"dateOfBirth\": \"${dob}T00:00:00.000Z\",
      \"status\": \"active\"
    }")

  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')

  if [[ "$http_code" == "200" || "$http_code" == "201" ]]; then
    echo "✓ Added: $name"
    ((added++))
  else
    echo "✗ Failed: $name (HTTP $http_code)"
    ((failed++))
  fi
done

echo ""
echo "✅ Complete: $added added, $failed failed"
