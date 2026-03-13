import os
import json
import re

def extract_data(file_path):
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Simple regex to find the object content between { and };
    # module.exports = { ... };
    match = re.search(r'module\.exports\s*=\s*\{(.*)\};', content, re.DOTALL)
    if not match:
        return {}
    
    inner_content = match.group(1)
    
    # Convert the JS object-like string to a list of (week_num, data_dict)
    # This is a bit tricky with nested dicts, so we'll do it week by week
    weeks = {}
    # Find patterns like "  1: { ... }"
    # We use a non-greedy match for the content and allow for an optional comma
    week_blocks = re.findall(r'(\d+):\s*\{(.*?)\n  \}(?:,)?', inner_content + '\n', re.DOTALL)
    
    for week_num_str, block in week_blocks:
        week_num = int(week_num_str)
        # Parse the block content into a dictionary
        data = {}
        
        # fruitName: "...",
        fruit_name_match = re.search(r'fruitName:\s*"(.*?)"', block)
        if fruit_name_match: data['fruitName'] = fruit_name_match.group(1)
        
        # fruitEmoji: "...",
        fruit_emoji_match = re.search(r'fruitEmoji:\s*"(.*?)"', block)
        if fruit_emoji_match: data['fruitEmoji'] = fruit_emoji_match.group(1)
        
        # babySize: "...",
        baby_size_match = re.search(r'babySize:\s*"(.*?)"', block)
        if baby_size_match: data['babySize'] = baby_size_match.group(1)
        
        # babyWeight: "...",
        baby_weight_match = re.search(r'babyWeight:\s*"(.*?)"', block)
        if baby_weight_match: data['babyWeight'] = baby_weight_match.group(1)
        
        # illustration: "...",
        illus_match = re.search(r'illustration:\s*"(.*?)"', block)
        if illus_match: data['illustration'] = illus_match.group(1)
        
        # babyDevelopment: "...",
        dev_match = re.search(r'babyDevelopment:\s*"(.*?)"', block)
        if dev_match: data['babyDevelopment'] = dev_match.group(1)
        
        # bodyChanges: "...",
        changes_match = re.search(r'bodyChanges:\s*"(.*?)"', block)
        if changes_match: data['bodyChanges'] = changes_match.group(1)
        
        # tips: ["...", "..."],
        tips_match = re.search(r'tips:\s*\[(.*?)\]', block, re.DOTALL)
        if tips_match:
            tips_str = tips_match.group(1)
            data['tips'] = [t.strip().strip('"') for t in tips_str.split(',') if t.strip()]
            
        # dosAndDonts: { do: [...], dont: [...] },
        # Simplified extraction for this specific structure
        do_match = re.search(r'do:\s*\[(.*?)\]', block, re.DOTALL)
        if do_match:
            do_list = [t.strip().strip('"') for t in do_match.group(1).split(',') if t.strip()]
            data['dosAndDonts'] = data.get('dosAndDonts', {})
            data['dosAndDonts']['do'] = do_list
            
        dont_match = re.search(r'dont:\s*\[(.*?)\]', block, re.DOTALL)
        if dont_match:
            dont_list = [t.strip().strip('"') for t in dont_match.group(1).split(',') if t.strip()]
            data['dosAndDonts'] = data.get('dosAndDonts', {})
            data['dosAndDonts']['dont'] = dont_list
            
        # travelAdvisory: { safe: ..., level: "...", note: "..." },
        travel_match = re.search(r'travelAdvisory:\s*\{(.*?)\}', block, re.DOTALL)
        if travel_match:
            travel_inner = travel_match.group(1)
            safe = "true" in re.search(r'safe:\s*(true|false)', travel_inner).group(1)
            level = re.search(r'level:\s*"(.*?)"', travel_inner).group(1)
            note = re.search(r'note:\s*"(.*?)"', travel_inner).group(1)
            data['travelAdvisory'] = {"safe": safe, "level": level, "note": note}
            
        # nutrition: [...],
        nut_match = re.search(r'nutrition:\s*\[(.*?)\]', block, re.DOTALL)
        if nut_match:
            data['nutrition'] = [t.strip().strip('"') for t in nut_match.group(1).split(',') if t.strip()]
            
        # exercises: [...],
        ex_match = re.search(r'exercises:\s*\[(.*?)\]', block, re.DOTALL)
        if ex_match:
            data['exercises'] = [t.strip().strip('"') for t in ex_match.group(1).split(',') if t.strip()]
            
        # warningSignsToWatch: [...],
        warn_match = re.search(r'warningSignsToWatch:\s*\[(.*?)\]', block, re.DOTALL)
        if warn_match:
            data['warningSignsToWatch'] = [t.strip().strip('"') for t in warn_match.group(1).split(',') if t.strip()]
            
        # milestoneTitle: "...",
        m_title_match = re.search(r'milestoneTitle:\s*"(.*?)"', block)
        if m_title_match: data['milestoneTitle'] = m_title_match.group(1)
        
        # milestoneDescription: "...",
        m_desc_match = re.search(r'milestoneDescription:\s*"(.*?)"', block)
        if m_desc_match: data['milestoneDescription'] = m_desc_match.group(1)
        
        weeks[week_num] = data
        
    return weeks

def main():
    base_dir = "."
    weeks_dir = os.path.join(base_dir, "weeks")
    if not os.path.exists(weeks_dir):
        os.makedirs(weeks_dir)
        
    all_weeks = {}
    for i in range(1, 4):
        file_path = os.path.join(base_dir, f"weeks_{i}.js")
        all_weeks.update(extract_data(file_path))
        
    for week_num, data in all_weeks.items():
        padded = str(week_num).zfill(2)
        full_data = {"week": week_num, **data}
        file_path = os.path.join(weeks_dir, f"week-{padded}.json")
        with open(file_path, 'w') as f:
            json.dump(full_data, f, indent=2, ensure_ascii=False)
            f.write('\n')
        print(f"Updated week-{padded}.json")

if __name__ == "__main__":
    main()
